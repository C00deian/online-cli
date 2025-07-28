const express = require('express');
const bodyParser = require('body-parser');
const instanceRoutes = require('./routes/instances');
const app = express();
const dotenv = require("dotenv");
const cors = require('cors');

app.use(cors());


dotenv.config({
 });

app.use(bodyParser.json());
app.use('/instances', instanceRoutes);


app.listen(3000, () => console.log("Backend API running at http://localhost:3000"));

