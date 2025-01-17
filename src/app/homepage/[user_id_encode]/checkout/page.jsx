"use client";
import "./checkout.css";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Knock } from "@knocklabs/node";

export default function CheckoutPage({ params }) {
  const route = useRouter();
  const knockClient = new Knock(process.env.NEXT_PUBLIC_KNOCK_SECRET);

  const user_id_encode = params.user_id_encode;
  const user_id = decodeURIComponent(user_id_encode);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState({});
  const [currentShopIndex, setCurrentShopIndex] = useState(null);
  const [currentShippingOptions, setCurrentShippingOptions] = useState([]);

  const [user_information, setUserInformation] = useState({
    user_name: "",
    user_phone: "",
    user_address: [],
  });

  /// use userID to get the data that user have checkout
  const [cart, setCart] = useState({});
  const openShipmentModal = (shopIndex) => {
    setCurrentShopIndex(shopIndex);
    setCurrentShippingOptions(cart.shop[shopIndex].shippingmethod);
    setShowShipmentModal(true);
  };
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(""); // Default selected payment method

  const [commonPaymentMethods, setCommonPaymentMethods] = useState([]);

  const handlePaymentMethodSelect = (method) => {
    setSelectedPaymentMethod(method);
  };
  const handleShipmentSelect = (id, shipment, price, note) => {
    setSelectedShipment((prevState) => ({
      ...prevState,
      [currentShopIndex]: { id, shipment, price, note },
    }));
    setShowShipmentModal(false);
  };

  useEffect(() => {
    async function fetchCheckout() {
      const response = await fetch(
        `/api/user/cart?user_id=${encodeURIComponent(user_id)}`
      );
      if (response.ok) {
        const data = await response.json();
        const cartShopsPromises = data.checkout.map(async (shop) => {
          const sellerId = shop[0].Seller_ID;
          const shopResponse = await fetch(
            `/api/user/information?user_id=${encodeURIComponent(sellerId)}`
          );
          const shopData = await shopResponse.json();
          const shippingmethod = await fetch(
            `/api/user/shipping_company_of_seller?seller_id=${encodeURIComponent(
              sellerId
            )}`
          );
          const paymentmethod = await fetch(
            `/api/user/payment_method_of_seller?seller_id=${encodeURIComponent(
              sellerId
            )}`
          );
          const paymentdata = await paymentmethod.json();
          const shippingdata = await shippingmethod.json();
          return {
            sellerId: sellerId,
            Shop_name: shopData.user.Shop_name,
            check: false,
            product: shop.map((item) => ({
              ...item,
              check: false,
              total: item.Quantity * parseFloat(item.Option_price),
            })),
            shippingmethod: shippingdata,
            paymentmethod: paymentdata,
          };
        });
        const cartShops = await Promise.all(cartShopsPromises);
        setCart({ shop: cartShops });
        console.log(cartShops);
      } else {
        console.error("Error:", response.statusText);
      }
    }
    async function fetchUserInformation() {
      const response = await fetch(
        `/api/user/information?user_id=${encodeURIComponent(user_id)}`
      );
      if (response.ok) {
        const data = await response.json();
        setUserInformation({
          user_name: data.user.FName + " " + data.user.LName,
          user_phone: data.user.Phone_Number,
          user_address: data.address.map((item) => item.Address),
        });
        setAddress(data.address[0].Address);
      } else {
        console.error("Error:", response.statusText);
      }
    }

    fetchCheckout();
    fetchUserInformation();
    function handleUnload(event) {
      event.preventDefault(); // This may be necessary to ensure the prompt is triggered in some browsers
      event.returnValue = ""; // Chrome requires returnValue to be set

      for (let shop of cart.shop) {
        for (let product of shop.product) {
          const data = {
            operation: "updateIsChecked",
            product_id: product.Product_ID,
            user_id: user_id,
            option_number: product.Option_number,
            isChecked: 0,
          };

          fetch("/api/user/cart", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
          }).then((response) => {
            if (!response.ok) {
              console.error(`Failed to update product ${product.product_id}`);
            }
          });
        }
      }
    }

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [user_id]);
  useEffect(() => {
    // Only proceed if there are shops in the cart
    if (cart.shop && cart.shop.length > 0) {
      // Extract all payment methods arrays
      const allPaymentMethods = cart.shop.map((shop) => shop.paymentmethod);

      // Calculate the intersection
      const commonPaymentMethods = allPaymentMethods.reduce(
        (commonMethods, methods) => {
          return commonMethods.filter((commonMethod) =>
            methods.some(
              (method) => method.Method_name === commonMethod.Method_name
            )
          );
        }
      );

      // Update the state to store common payment methods
      setCommonPaymentMethods(commonPaymentMethods); // Ensure you have a useState for this
    }
  }, [cart.shop]); // Dependency on cart.shop to recalculate when shops are updated

  async function handleBack() {
    for (let shop of cart.shop) {
      for (let product of shop.product) {
        const data = {
          operation: "updateIsChecked",
          product_id: product.Product_ID,
          user_id: user_id,
          option_number: product.Option_number,
          isChecked: 0,
        };

        const response = await fetch("/api/user/cart", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          alert(`Failed to update product ${product.product_id}`);
        }
      }
    }
    // Redirect to the previous page or any other page
    route.push(`/homepage/${encodeURIComponent(user_id)}/cart`);
  }
  function calculateTotalPrice() {
    let total = 0;
    if (cart.shop && Array.isArray(cart.shop)) {
      cart.shop.forEach((shop, index) => {
        const shopTotal = shop.product.reduce((a, b) => a + b.total, 0);
        const shipmentCost = selectedShipment[index]?.price || 0;
        total += shopTotal + shipmentCost;
      });
    }
    return total;
  }

  const handleUserInfoChange = (key, value) => {
    setUserInformation((prev) => ({
      ...prev,
      [key]: value,
    }));
  };
  const totalPrice = calculateTotalPrice();
  async function handle_checkout() {
    if (!selectedPaymentMethod) {
      alert("Vui lòng chọn phương thức thanh toán.");
      return;
    }

    // Check if all shops have a selected shipping method
    const allShopsHaveShipping = cart.shop.every(
      (_, index) => selectedShipment[index]
    );
    if (!allShopsHaveShipping) {
      alert("Vui lòng chọn phương thức vận chuyển cho tất cả các cửa hàng.");
      return;
    }
    let new_cart = { ...cart };

    for (let shop of new_cart.shop) {
      let Product_list = [];
      shop.product.forEach((product) => {
        Product_list.push({
          Product_ID: product.Product_ID,
          Option_number: product.Option_number,
          Quantity: product.Quantity,
          Discount_percentage: product.Discount_percentage,
          Original_price: product.Option_price,
          Final_price: product.Option_price * product.Quantity,
        });
      });

      if (Product_list.length > 0) {
        const data = {
          Seller_ID: shop.sellerId, // Seller_ID is obtained from the first checked product
          Customer_ID: user_id, // Replace with actual Customer_ID
          Address: address, // Replace with actual Address
          Total_quantity: Product_list.length,
          Product_list,
          Customer_name: user_information.user_name,
          Customer_phone_number: user_information.user_phone,
          Note: note,
          Shipping_company_ID: selectedShipment[0].id,
          Payment_method_id: selectedPaymentMethod,
        };

        // Make API request to server
        const response = await fetch("/api/user/order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          alert("Checkout failed");
          return;
        } else {
          await knockClient.workflows.trigger("buyproduct", {
            recipients: [shop.sellerId],
            actor: user_id,
          });
        }
        for (let product of Product_list) {
          const deleteResponse = await fetch("/api/user/cart", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              product_id: product.Product_ID,
              user_id: user_id,
              option_number: product.Option_number,
            }),
          });

          if (!deleteResponse.ok) {
            alert(`Failed to remove product ${product.Product_ID} from cart`);
          }
        }
      }
    }

    alert("Order has been placed");

    route.push(`/homepage/${encodeURIComponent(user_id)}/order_managment`);
  }
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
          {isEditing ? (
            <>
              <input
                type="text"
                value={user_information.user_name}
                onChange={(e) =>
                  handleUserInfoChange("user_name", e.target.value)
                }
                placeholder="Ho va ten"
              />
              <input
                type="text"
                value={user_information.user_phone}
                onChange={(e) =>
                  handleUserInfoChange("user_phone", e.target.value)
                }
                placeholder="So dien thoai"
              />
              {isEditingAddress ? (
                <input
                  type="text"
                  value={address}
                  style={{ width: "350px" }}
                  onChange={(e) => setAddress(e.target.value)}
                />
              ) : (
                <select
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                >
                  {user_information.user_address.map((address, index) => (
                    <option key={index} value={address}>
                      {address}
                    </option>
                  ))}
                </select>
              )}
              <Image
                src="/edit_user_in4.png"
                alt="Edit"
                width={20}
                height={20}
                onClick={() => setIsEditingAddress(!isEditingAddress)}
                style={{ cursor: "pointer" }}
              />
            </>
          ) : (
            <>
              <p>
                {user_information.user_name} {user_information.user_phone}
              </p>
              <p>{address}</p>
            </>
          )}
          <button onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? "Xong" : "Thay doi"}
          </button>
          {isEditing && (
            <button onClick={() => setIsEditing(false)}>Huy</button>
          )}
        </div>
      </div>
      <div className="field_bar_checkout">
        <div>
          <p>San Pham</p>
        </div>
        <div>
          <p>Don gia</p>
          <p>So luong</p>
          <p>Thanh tien</p>
        </div>
      </div>
      {cart.shop &&
        Array.isArray(cart.shop) &&
        cart.shop.map((shop, index) => {
          return (
            <div className="shop_checkout" key={index}>
              <div className="shop_checkout_header">
                <p className="s ">{shop.Shop_name}</p>
              </div>
              {shop.product.map((product, productIndex) => {
                return (
                  <div className="product_checkout" key={productIndex}>
                    <div className="product_checkout_left_section">
                      <Image
                        src={product.Image_url}
                        alt="product_img"
                        width={100}
                        height={100}
                      />
                      <div className="product_information_checkout">
                        <p>{product.Product_title}</p>
                        <p>{product.Option_name}</p>
                      </div>
                    </div>
                    <div className="product_checkout_right_section">
                      <div>
                        <p>{product.Option_price} 円</p>
                      </div>
                      <div>
                        <p>{product.Quantity}</p>
                      </div>
                      <div>
                        <p>{product.total} 円</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="checkout_information_shipping">
                <div>
                  <p>Ghi chu</p>
                  <textarea
                    placeholder="lời nhắn cho người bán"
                    maxLength="200"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  ></textarea>
                </div>
                <div className="shipping_selection">
                  <p>Đơn vị vận chuyển</p>
                  <button onClick={() => openShipmentModal(index)}>
                    Chọn vận chuyển
                  </button>
                  <p className="shipment_status">
                    {selectedShipment[index] ? (
                      <>
                        <strong>{selectedShipment[index].shipment}</strong>
                        <span className="shipment_status_price">
                          ₫{selectedShipment[index].price.toLocaleString()}
                        </span>
                        <span className="shipment_note">
                          {selectedShipment[index].note}
                        </span>{" "}
                        {/* Make sure it's .note */}
                      </>
                    ) : (
                      "Chưa chọn"
                    )}
                  </p>
                </div>
              </div>
              {/* Shipping modal */}
              {showShipmentModal && (
                <div className="modal">
                  <div className="modal-content">
                    <h3>Chọn đơn vị vận chuyển</h3>
                    <ul>
                      {currentShippingOptions.map((option) => (
                        <li
                          key={option.Company_ID}
                          onClick={() =>
                            handleShipmentSelect(
                              option.Company_ID,
                              option.Company_name,
                              parseInt(option.Price),
                              option.Note
                            )
                          }
                        >
                          <strong>{option.Company_name}</strong> - ₫
                          {option.Price.toLocaleString()}
                          <div>{option.Note}</div>
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => setShowShipmentModal(false)}>
                      Đóng
                    </button>
                  </div>
                </div>
              )}

              <div>
                <p>
                  Tổng cộng:{" "}
                  {shop.product.reduce((a, b) => a + b.total, 0) +
                    (selectedShipment[index]
                      ? selectedShipment[index].price
                      : 0)}{" "}
                  円
                </p>
              </div>
            </div>
          );
        })}
      <div className="checkout_information_payment">
        <p>Phương thức thanh toán</p>
        <div className="payment_methods">
          {commonPaymentMethods.length > 0 ? (
            commonPaymentMethods.map((method) => (
              <div
                key={method.Method_ID}
                className={`payment_method ${
                  selectedPaymentMethod === method.Method_ID ? "selected" : ""
                }`}
                onClick={() => handlePaymentMethodSelect(method.Method_ID)}
              >
                {method.Method_name}
              </div>
            ))
          ) : (
            <p>No common payment methods available</p>
          )}
        </div>
      </div>
      <div className="checkout_final_step">
        <div>
          <p>Tong tien hang: </p> <p>{totalPrice} 円</p>
        </div>

        <button onClick={handle_checkout}>Dat hang</button>
        <button className="back-button" onClick={handleBack}>
          Quay lại
        </button>
      </div>
    </div>
  );
}
