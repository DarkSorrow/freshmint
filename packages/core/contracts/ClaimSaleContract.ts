// @ts-ignore
import * as fcl from '@onflow/fcl';

// @ts-ignore
import * as t from '@onflow/types';

import { ClaimSaleGenerator } from '../generators/ClaimSaleGenerator';

import NFTContract from './NFTContract';
import { FreshmintConfig, ContractImports } from '../config';
import { Transaction, TransactionAuthorizer, TransactionResult } from '../transactions';
import { Path } from '../cadence/values';
import { Script } from '../scripts';

const flowTokenReceiverPublicPath = '/public/flowTokenReceiver';

export interface ClaimSale {
  id: string;
  price: string;
  size: number;
  supply: number;
}

export class ClaimSaleContract {
  nftContract: NFTContract;

  constructor(nftContract: NFTContract) {
    this.nftContract = nftContract;
  }

  getSource(imports: ContractImports): string {
    return ClaimSaleGenerator.contract({
      imports,
    });
  }

  start({
    id,
    price,
    paymentReceiverAddress,
    paymentReceiverPath,
    bucket,
    claimLimit,
    allowlist,
  }: {
    id: string;
    price: string;
    paymentReceiverAddress?: string;
    paymentReceiverPath?: string;
    bucket?: string;
    claimLimit?: number;
    allowlist?: string;
  }): Transaction<void> {
    const signers = this.nftContract.getSigners();

    // Payment receiver address defaults to the transaction signer
    const receiverAddress = paymentReceiverAddress ?? signers.authorizers[0].address;

    // Payment receiver path defaults to the FLOW token receiver
    const receiverPath = paymentReceiverPath ?? flowTokenReceiverPublicPath;

    return new Transaction(({ imports }: FreshmintConfig) => {
      const script = ClaimSaleGenerator.startSale({
        imports,
        contractName: this.nftContract.name,
        contractAddress: this.nftContract.getAddress(),
      });

      return {
        script,
        args: [
          fcl.arg(id, t.String),
          fcl.arg(price, t.UFix64),
          fcl.arg(receiverAddress, t.Address),
          fcl.arg(Path.fromString(receiverPath), t.Path),
          fcl.arg(bucket, t.Optional(t.String)),
          fcl.arg(claimLimit ?? null, t.Optional(t.UInt)),
          fcl.arg(allowlist ?? null, t.Optional(t.String)),
        ],
        computeLimit: 9999,
        signers,
      };
    }, Transaction.VoidResult);
  }

  stop(id: string): Transaction<void> {
    return new Transaction(({ imports }: FreshmintConfig) => {
      const script = ClaimSaleGenerator.stopSale({
        imports,
        contractName: this.nftContract.name,
        contractAddress: this.nftContract.getAddress(),
      });

      return {
        script,
        args: [fcl.arg(id, t.String)],
        computeLimit: 9999,
        signers: this.nftContract.getSigners(),
      };
    }, Transaction.VoidResult);
  }

  addToAllowlist({
    name,
    addresses,
    claims,
  }: {
    name: string;
    addresses: string[];
    claims: number;
  }): Transaction<void> {
    return new Transaction(({ imports }: FreshmintConfig) => {
      const script = ClaimSaleGenerator.addToAllowlist({
        imports,
        contractName: this.nftContract.name,
        contractAddress: this.nftContract.getAddress(),
      });

      return {
        script,
        args: [fcl.arg(name, t.String), fcl.arg(addresses, t.Array(t.Address)), fcl.arg(claims.toString(10), t.UInt)],
        computeLimit: 9999,
        signers: this.nftContract.getSigners(),
      };
    }, Transaction.VoidResult);
  }

  // TODO: move this function and/or refactor this class
  //
  // This is a transaction that is only executed by client, who does not need
  // access to the "admin" settings of a project.
  //
  // What is the best way to separate the two?
  claimNFT(saleAddress: string, authorizer: TransactionAuthorizer, saleId: string): Transaction<string> {
    return new Transaction(
      ({ imports }: FreshmintConfig) => {
        const script = ClaimSaleGenerator.claimNFT({
          imports,
          contractName: this.nftContract.name,
          contractAddress: this.nftContract.getAddress(),
        });

        return {
          script,
          args: [fcl.arg(saleAddress, t.Address), fcl.arg(saleId, t.String)],
          computeLimit: 9999,
          signers: {
            payer: authorizer,
            proposer: authorizer,
            authorizers: [authorizer],
          },
        };
      },
      ({ events }: TransactionResult) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const claimedEvent = events.find((event) => event.type.includes('FreshmintClaimSale.NFTClaimed'))!;

        const nftId = claimedEvent.data['nftID'];

        return nftId;
      },
    );
  }

  getSale(saleAddress: string, saleId: string): Script<ClaimSale | null> {
    return new Script(
      ({ imports }: FreshmintConfig) => {
        const script = ClaimSaleGenerator.getClaimSale({ imports });

        return {
          script,
          args: (arg, t) => [arg(saleAddress, t.Address), arg(saleId, t.String)],
          computeLimit: 9999,
        };
      },
      (result) => {
        if (!result) {
          return null;
        }

        return {
          id: result.id,
          price: result.price,
          supply: parseInt(result.supply, 10),
          size: parseInt(result.size, 10),
        };
      },
    );
  }
}
