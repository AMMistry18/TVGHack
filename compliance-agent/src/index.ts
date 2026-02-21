import express from "express";
import cors from "cors";
import reportRouter from "./routes/report.js";

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));
app.use("/", reportRouter);

app.listen(port, () => {
  console.log(`Compliance agent listening on http://localhost:${port}`);
});
