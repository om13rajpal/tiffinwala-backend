import app from "./app";
import http from "http";
import { PORT } from "./config/config";

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
