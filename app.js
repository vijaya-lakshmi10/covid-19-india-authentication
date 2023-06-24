const express = require("express");
const app = express();
app.use(express.json());
const bcrypt = require("bcrypt");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const jwt = require("jsonwebtoken");
let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DBError:${error.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "my_secret_token", async (e, payload) => {
      if (e) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};
//Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const hasPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (hasPasswordMatched === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "my_secret_token");
      response.send({ jwtToken });
    }
  }
});
const convertStatesToCamelCase = (dbObject1) => {
  return {
    stateId: dbObject1.state_id,
    stateName: dbObject1.state_name,
    population: dbObject1.population,
  };
};
const convertDistrictsToCamelCase = (dbObject2) => {
  return {
    districtId: dbObject2.district_id,
    districtName: dbObject2.district_name,
    stateId: dbObject2.state_id,
    cases: dbObject2.cases,
    cured: dbObject2.cured,
    active: dbObject2.active,
    deaths: dbObject2.deaths,
  };
};

//Get all states API
app.get("/states/", authenticateToken, async (request, response) => {
  const getAllStatesQuery = `
    SELECT * FROM
    state
    ORDER BY state_id;`;
  const getAllStatesArray = await db.all(getAllStatesQuery);
  response.send(
    getAllStatesArray.map((state) => convertStatesToCamelCase(state))
  );
});

//Get state based on stateId
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateBasedOnIdQuery = `
    SELECT state_id as stateId,
    state_name as stateName,
    population as population FROM state
    WHERE state_id=${stateId};`;
  const getStateBasedOnId = await db.get(getStateBasedOnIdQuery);
  response.send(getStateBasedOnId);
});

//Add New District API
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addNewDistrictQuery = `
    INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
    VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  await db.run(addNewDistrictQuery);
  response.send("District Successfully Added");
});

//Get District Based on DistrictId API
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictIdQuery = `
    SELECT district_id as districtId,
    district_name as districtName,
    state_id as stateId,
    cases,cured,active,deaths
    FROM district WHERE district_id=${districtId};`;
    const getDistrictId = await db.get(getDistrictIdQuery);
    response.send(getDistrictId);
  }
);

//Delete District API
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
      DELETE FROM district
      WHERE district_id=${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//Update District Details API
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const changeDistrictDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = changeDistrictDetails;
    const updateDistrictDetailsQuery = `
    UPDATE district
    SET district_name='${districtName}',
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths}
    WHERE district_id=${districtId};`;
    await db.run(updateDistrictDetailsQuery);
    response.send("District Details Updated");
  }
);

//Get total statistics API
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `
    SELECT SUM(cases) as totalCases,
    SUM(cured) as totalCured,
    SUM(active) as totalActive,
    SUM(deaths) as totalDeaths
    FROM district WHERE state_id=${stateId};`;
    const dbResponse = await db.get(getStatsQuery);
    response.send(dbResponse);
  }
);
module.exports = app;
