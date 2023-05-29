const { program } = require('commander');
const fs = require('fs');
const GAS_REPORT_FILE = `${__dirname}/../gasReporterOutput.json`;
const DEFAULT_METHOD_LIMIT_GAS = '1000000';
const DEFAULT_DEPLOYMENT_LIMIT_GAS = '2000000';

program
  .option('--method-limit-gas <number>')
  .option('--deployment-limit-gas <number>');

const calcMaxAndAvg = (gasData) => {
  let sum = 0;
  let max = 0;

  gasData.forEach(num => {
    sum += num;
    if (num > max) {
      max = num;
    }
  });

  return {
    max,
    avg: Math.trunc(sum / gasData.length)
  }
};

async function main() {
  fs.accessSync(GAS_REPORT_FILE);

  program.parse();
  const options = program.opts();
  const methodLimitGas = Number(options.methodLimitGas || DEFAULT_METHOD_LIMIT_GAS);
  const deploymentLimitGas = Number(options.deploymentLimitGas || DEFAULT_DEPLOYMENT_LIMIT_GAS);

  const json = JSON.parse(fs.readFileSync(GAS_REPORT_FILE, 'utf-8'));
  const methods = json['info']['methods'];
  const deployments = json['info']['deployments'];

  let cntOfMethod = 0;
  console.log('--------------------------------------------------');
  console.log(`List of methods that exceed gas usage: (gas-limit: ${methodLimitGas})`);
  console.log('--------------------------------------------------');
  Object.keys(methods).forEach(key => {
    if (methods[key].numberOfCalls > 0) {
      const contract = methods[key].contract;
      const mname = methods[key].method;
      const fnSig = methods[key].fnSig;
      const { max, avg } = calcMaxAndAvg(methods[key].gasData);

      if (max >= methodLimitGas || avg >= methodLimitGas) {
        console.log(`${contract}|${mname}|${fnSig}|${max}|${avg}`);
        cntOfMethod++;
      }
    }
  });
  if (cntOfMethod === 0) {
    console.log('(nothing)');
  }
  console.log('');

  let cntOfDeployment = 0;
  console.log('--------------------------------------------------');
  console.log(`List of deployments that exceed gas usage: (gas-limit: ${deploymentLimitGas})`);
  console.log('--------------------------------------------------');
  deployments.forEach(elem => {
    if (elem.deployedBytecode !== '0x') {
      const { max, avg } = calcMaxAndAvg(elem.gasData);

      if (max >= deploymentLimitGas || avg >= deploymentLimitGas) {
        console.log(`${elem.name}|${max}|${avg}`);
        cntOfDeployment++;
      }
    }
  });
  if (cntOfDeployment === 0) {
    console.log('(nothing)');
  }
}

main().catch((error) => {
  console.log(error);
  process.exitCode = 1;
});
