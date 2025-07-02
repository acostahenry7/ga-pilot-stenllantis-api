const axios = require("axios");
const https = require("https");
const fs = require("fs");
const {
  credentials: { clientId, clientSecret, grantType, username, password },
  pilotParams,
} = require("./config");
const { generateUrlParams, getModelByCode } = require("./utils");
const authURL = "https://api-secure.forms.awsmpsa.com/oauth/v2/token";
const stellantisUrl = "https://api-secure.forms.awsmpsa.com/formsv3/api/leads";
const pilotUrl = "https://api.pilotsolution.net/webhooks/welcome.php";

const httpsAgent = new https.Agent({
  cert: fs.readFileSync("./cert.cer"),
  key: fs.readFileSync("./key.pk"),
  rejectUnauthorized: false,
});

const subOriginCodes = {
  sd: "FJ43VEW8D7BDJESQO",
  st: "FUUMONS9V11SZUZ39",
};

//AUTHENTICATION (This gets the Bearer Token)
const getToken = async () => {
  const url = `${authURL}?client_id=${clientId}&client_secret=${clientSecret}&grant_type=${grantType}&username=${username}&password=${password}`;

  return axios
    .get(url, {
      headers: {
        Accept: "*/*",
      },
      httpsAgent,
    })
    .then((res) => {
      return res;
    });
};

//GET DATA FROM SOURCE REST API (Retrieves data in JSON format from "source" api)
const fetchData = async (token) => {
  const todayDate = new Date().toISOString().split("T")[0];
  return axios
    .post(
      stellantisUrl,
      {
        startDate: `${todayDate}T01:00:00.843+00:00`,
        endDate: `${todayDate}T23:59:59.843+00:00`,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        httpsAgent,
      }
    )
    .then((res) => {
      return res;
    })
    .catch((err) => {
      throw err;
    });
};

//POST OBJECT TO DESTINATION (This creates the Lead instance into Pilot CRM)
const stCodes = ["CDO005S", "CDO002S"];
const postData = async (leads) => {
  console.log(`Uploading leads...`);
  const processedLeads = {
    success: [],
    error: [],
  };
  for (let l of leads) {
    let params = {
      ...pilotParams,
      pilot_suborigin_id: stCodes.some(
        (item) => item == l.leadData.dealers[0]?.geoSiteCode
      )
        ? subOriginCodes.st
        : subOriginCodes.sd,
      pilot_firstname: l.leadData.customer.firstname,
      pilot_lastname: l.leadData.customer.lastname,
      pilot_email: l.leadData.customer.email,
      pilot_cellphone: l.leadData.customer.personalMobilePhone,
      pilot_notes: l.leadData.comments || "",
      pilot_notificacions_opt_in_consent_flag:
        l.leadData.consents?.some((c) => c.consentValue == true) ?? false,
      pilot_product_of_interest: getModelByCode(
        l.leadData.interestProduct.lcdv
      ),
    };

    let url = `${pilotUrl}${generateUrlParams(params)}`;

    try {
      await axios.post(url);
      console.log("Lead uploaded! --> ", l.gitId);

      processedLeads.success.push(l);
    } catch (error) {
      console.log(`Error on lead ${l.gitId}`);
      console.log(error.response.data.data);
      processedLeads.error.push(l);
    }
  }

  return processedLeads;
};

//COMPARE TO LOCAL DATA
const validateNewLeads = (leads, file) => {
  return new Promise((resolve, reject) => {
    fs.readFile(file, (err, data) => {
      if (err) {
        reject(err);
      }

      const localLeads = JSON.parse(data);
      const newLeads = leads.filter(
        (nl) => localLeads.some((lcl) => lcl.gitId == nl.gitId) == false
      );
      // console.log(newLeads.map((al) => al.gitId));
      //   console.log(newLeads.length);

      resolve({ localLeads, newLeads });
    });
  });
};

const createJsonFile = (name, data) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(`${name}`, JSON.stringify(data), (err) => {
      if (err) {
        console.error("Error writing file:", err);
        reject();
      } else {
        console.log("File processed successfully!");
        resolve();
      }
    });
  });
};

//MTc0OTAzNjM1OGZkdWp0
//MTc0OTAzNjM3NEMyVHNV
//MTc0OTA0MjMyMExyRVAy

//MAIN
getToken()
  .then((res) => {
    console.log("Token Received!");
    console.log("Feching Data from source...");
    //Fetching
    fetchData(res.data.access_token)
      .then(async (res) => {
        console.log("Data fetched successfully!");

        //Posting
        const date = new Date().toISOString().split("T")[0];
        const filename = `leads-${date}.json`;

        if (res.data.message.lenght == 0) {
          throw new Error("Not data was fetched");
        }

        //Validate if file doesn't exists
        if (!fs.existsSync(filename)) {
          await createJsonFile(filename, res.data.message);
          postData(res.data.message);
        } else {
          //validate if there are some new leads
          const { localLeads, newLeads } = await validateNewLeads(
            res.data.message,
            filename
          );

          if (newLeads?.length > 0) {
            console.log(`New leads fetched...[${newLeads.length}]`);
            console.log("Preparing to post the new leads...");
            const { success, error } = await postData(newLeads);
            console.log("Local Database is up to date!");
            await createJsonFile(filename, [...localLeads, ...success]);
            if (error.length > 0)
              console.log("Leads not uploaded due to errors");
            console.log(error.map((l) => l.gitId).join("\n"));
          } else {
            console.log("Local Database is up to date!");
            console.log("No new leads where found. Nothing to update.");
          }
        }
      })
      .catch((err) => {
        if (err.message.includes("404")) {
          console.log(
            "No data was fetched from",
            stellantisUrl,
            "for the current date."
          );
        } else {
          console.log(`Error fetching data from source ${err}`);
        }
      });
  })
  .catch((err) => {
    console.log(`Error getting the token ${err}`);
  });
