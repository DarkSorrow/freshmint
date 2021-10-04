const util = require("util");
const exec = util.promisify(require("child_process").exec);

async function handleError(error) {
  console.error(error);
  return;
}

class FlowCliWrapper {
  constructor() {}

  async deploy(network = "emulator") {
    const { stderr: deployCoreContractsError } = await exec(
      `flow project deploy --network=${network} -f flow.json --update -o json`
    );

    if (deployCoreContractsError) {
      handleError(deployCoreContractsError);
    }

    const { stdout: out2, stderr: deployCustomContractError } = await exec(
      `flow project deploy --network=${network} -f flow.json -f minty-deployment.json --update -o json`
    );

    if (deployCustomContractError) {
      handleError(deployCustomContractError);
    }

    return JSON.parse(out2);
  }

  async setupAccount(network = "emulator") {
    const { stdout: out, stderr: setupAccountError } = await exec(
      `flow transactions send --network=${network} ./flow/cadence/transactions/setup_account.cdc -f minty-deployment.json -f flow.json`
    );

    if (setupAccountError) {
      handleError(setupAccountError);
    }

    return JSON.parse(out);
  }

  async mint(network = "emulator") {
    const { stdout: out, stderr: mintingError } = await exec(
      `flow transactions send --network=${network} ./flow/cadence/transactions/mint.cdc -f minty-deployment.json -f flow.json`
    );

    if (mintingError) {
      handleError(mintingError);
    }

    return JSON.parse(out);
  }
}

module.exports = FlowCliWrapper;
