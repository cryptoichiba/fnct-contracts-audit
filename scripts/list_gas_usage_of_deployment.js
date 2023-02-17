const fs = require('fs');
const GAS_REPORT_FILE = `${__dirname}/../gasReporterOutput.json`;

async function main() {
  fs.accessSync(GAS_REPORT_FILE);
  const json = JSON.parse(fs.readFileSync(GAS_REPORT_FILE, 'utf-8'));
  const deployments = json['info']['deployments'];

  deployments.forEach(elem => {
    if (elem.deployedBytecode !== '0x') {
      elem.gasData.forEach(gas => {
        console.log(`${elem.name}|${gas}`);
      });
    }
  });
}

main().catch((error) => {
  console.log(error);
  process.exitCode = 1;
});
