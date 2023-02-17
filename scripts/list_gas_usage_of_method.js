const fs = require('fs');
const GAS_REPORT_FILE = `${__dirname}/../gasReporterOutput.json`;

async function main() {
  fs.accessSync(GAS_REPORT_FILE);
  const json = JSON.parse(fs.readFileSync(GAS_REPORT_FILE, 'utf-8'));
  const methods = json['info']['methods'];

  Object.keys(methods).forEach(key => {
    if (methods[key].numberOfCalls > 0) {
      const contract = methods[key].contract;
      const mname = methods[key].method;
      methods[key].gasData.forEach(gas => {
        console.log(`${contract},${mname},${gas}`);
      });
    }
  });
}

main().catch((error) => {
  console.log(error);
  process.exitCode = 1;
});
