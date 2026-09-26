import { EcowittShareProvider } from "./ecowitt-share-provider.js";

const shareUrl = process.env.ECOWITT_SHARE_URL;
if (!shareUrl) {
  console.error("ECOWITT_SHARE_URL is required. Example: node src/poc.js (with environment variable set)");
  process.exitCode = 2;
} else {
  try {
    const result = await new EcowittShareProvider().fetchStation(shareUrl, process.env.ECOWITT_DEVICE_ID || null);
    console.log(JSON.stringify(result, null, 2));
    console.error(`OK: ${result.station.name}; ${result.measurements.length} dynamically discovered measurements`);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
