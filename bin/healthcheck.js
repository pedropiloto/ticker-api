const http = require("http");
const options = {
  host: "0.0.0.0",
  path: "/health",
  port: process.env.PORT || 3000,
  timeout: 2000,
};

const healthCheck = http.request(options, (res) => {
  if (res.statusCode == 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

healthCheck.on("error", function () {
  process.exit(1);
});

healthCheck.end();
