const carCodes = {
  "1CSC": "NUEVO SUV AIRCROSS",
  "1CCE": "C5 AIRCROSS",
  "2CK9": "BERLINGO MULTISPACE",
  "1CK9": "BERLINGO VAN",
  "1CLP": "C4 CACTUS",
  "2CXE": "JUMPER",
  "2CK0": "JUMPY",
};

const generateUrlParams = (obj) => {
  let params = "";

  Object.entries(obj).map(([key, val], index) => {
    let div = "&";
    if (index == 0) div = "?";
    params += `${div}${key}=${val}`;
  });

  return params;
};

const getModelByCode = (code) => {
  if (!code) {
    console.log("No model was found");
    return "";
  }
  return carCodes[code];
};

module.exports = {
  generateUrlParams,
  getModelByCode,
};

// console.log(
//   generalUrlParams({
//     action: "create",
//     appkey: "C817D81C-67ED-482A-A4A7-1911A2DFF100",
//     pilot_suborigin_id: "FJ43VEW8D7BDJESQO",
//     pilot_contact_type_id: 1,
//     pilot_contact_type_code: 1,
//     pilot_business_type_id: 7,
//     pilot_business_type_code: 7,
//   })
// );
