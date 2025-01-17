"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./view_order.css";
import Image from "next/image";
import AWS from "aws-sdk";
AWS.config.update({
  accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
  region: process.env.NEXT_PUBLIC_AWS_REGION,
});
export default function CheckoutPage({ params }) {
  const router = useRouter();
  const customer_id = params.customer_id;
  const Order_ID = params.order_id;
  const [seller_id, setSellerID] = useState("");

  const [orderDetails, setOrderDetails] = useState(null);
  const [user_information, setUserInformation] = useState({
    user_name: "",
    user_phone: "",
    user_address: [],
  });
  const [address, setAddress] = useState("");
  const [note, setNote] = useState(
    "The padding property in CSS does not accept auto as a value. It only accepts length values (like px, em, rem, etc.) or percentages. If you want to center the content within the div, you might want to use margin: auto instead, along with a specified width."
  );

  useEffect(() => {
    fetch(`/api/user/order?order_id=${Order_ID}`)
      .then((response) => response.json())
      .then((data) => {
        setUserInformation({
          user_name: data.body.order.Customer_name,
          user_phone: data.body.order.Customer_phone_number,
        });
        const orderData = data.body.order;
        setNote(data.body.order.Note);

        setSellerID(data.body.order.Seller_ID);
        setAddress(data.body.order.Address);
        const orderItems = data.body.order_items;
        const productPromises = orderItems.map((item) =>
          fetch(`/api/user/product?product_id=${item.Product_ID}`).then(
            (response) => response.json()
          )
        );
        return Promise.all(productPromises).then((productData) => {
          const enrichedOrderData = orderItems.map((item, index) => ({
            ...item,
            productDetails: productData[index],
          }));
          setOrderDetails({
            ...orderData,
            orderItems: enrichedOrderData,
          });
        });
      })

      .catch((error) => console.error(error));
  }, [Order_ID]);

  function calculateTotalPrice() {
    let total = 0;
    if (orderDetails && orderDetails.orderItems) {
      total = orderDetails.orderItems.reduce(
        (acc, order) => acc + Number(order.Final_price),
        0
      );
    }
    return total;
  }

  const totalPrice = calculateTotalPrice();
  return (
    <div className="checkout_page_container">
      <div className="address_checkout_page">
        <div className="header_address_checkout">
          <Image
            src="/location_checkout.png"
            alt="location icon"
            width={20}
            height={20}
          />
          <p>Dia chi nhan hang</p>
        </div>
        <div className="information_address_checkout">
          <p>
            {user_information.user_name} {user_information.user_phone}
          </p>
          <p>{address}</p>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th style={{ padding: "0 60px" }}>Hình ảnh</th>
            <th style={{ padding: "0 60px" }}>Tên</th>
            <th style={{ padding: "0 60px" }}>Option</th>
            <th style={{ padding: "0 60px" }}>Đơn giá</th>
            <th style={{ padding: "0 60px" }}>Số lượng</th>
            <th style={{ padding: "0 60px" }}>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {orderDetails?.orderItems?.map((order, index) => (
            <>
              <tr key={index}>
                <td style={{ padding: "0 60px" }}>
                  <Image
                    src={order.productDetails.images[0].Image_url}
                    alt="product_img"
                    width={100}
                    height={100}
                  />
                </td>
                <td style={{ padding: "0 60px" }}>
                  <div>
                    <p>{order.productDetails.Product_title}</p>
                  </div>
                </td>
                <td style={{ padding: "0 60px" }}>
                  {
                    order.productDetails.options[order.Option_number]
                      .Option_name
                  }
                </td>
                <td style={{ padding: "0 60px" }}>{order.Original_price} 円</td>
                <td style={{ padding: "0 60px" }}>{order.Quantity}</td>
                <td style={{ padding: "0 60px" }}>{order.Final_price} 円</td>
              </tr>
            </>
          ))}
        </tbody>
      </table>

      <div className="checkout_final_step">
        <div>
          <p>Tong tien hang: </p> <p>{totalPrice} 円</p>
        </div>
        <p>Ghi chu</p>
        <div
          style={{
            border: "1px solid black",
            width: "400px",
            padding: "10px 20px",
          }}
        >
          {note}
        </div>
        <button
          style={{ marginTop: "20px" }}
          onClick={() =>
            router.push(
              `/seller_mode/${seller_id}/${seller_id}/order_management`
            )
          }
        >
          Quay lai
        </button>
      </div>
    </div>
  );
}
