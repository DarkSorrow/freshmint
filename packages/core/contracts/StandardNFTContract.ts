// @ts-ignore
import * as fcl from '@onflow/fcl';
// @ts-ignore
import * as t from '@onflow/types';

import { NFTContract, CollectionMetadata, prepareCollectionMetadata, Royalty, prepareRoyalties } from './NFTContract';
import { MetadataMap } from '../metadata';
import { StandardNFTGenerator } from '../generators/StandardNFTGenerator';
import { FreshmintConfig, ContractImports } from '../config';
import { PublicKey, SignatureAlgorithm, HashAlgorithm } from '../crypto';
import { Transaction, TransactionResult } from '../transactions';

export type NFTMintResult = {
  id: string;
  metadata: MetadataMap;
  transactionId: string;
};

export class StandardNFTContract extends NFTContract {
  getSource(imports: ContractImports, options?: { saveAdminResourceToContractAccount?: boolean }): string {
    return StandardNFTGenerator.contract({
      imports,
      contractName: this.name,
      schema: this.schema,
      saveAdminResourceToContractAccount: options?.saveAdminResourceToContractAccount,
    });
  }

  deploy({
    publicKey,
    hashAlgorithm,
    collectionMetadata,
    royalties,
    saveAdminResourceToContractAccount,
  }: {
    publicKey: PublicKey;
    hashAlgorithm: HashAlgorithm;
    collectionMetadata: CollectionMetadata;
    royalties?: Royalty[];
    saveAdminResourceToContractAccount?: boolean;
  }): Transaction<string> {
    return new Transaction(
      ({ imports }: FreshmintConfig) => {
        const script = StandardNFTGenerator.deploy({ imports });

        const contractCode = this.getSource(imports, { saveAdminResourceToContractAccount });
        const contractCodeHex = Buffer.from(contractCode, 'utf-8').toString('hex');

        const sigAlgo = publicKey.signatureAlgorithm();

        const { royaltyAddresses, royaltyReceiverPaths, royaltyCuts, royaltyDescriptions } = prepareRoyalties(
          royalties ?? [],
        );

        return {
          script,
          args: [
            fcl.arg(this.name, t.String),
            fcl.arg(contractCodeHex, t.String),
            fcl.arg(publicKey.toHex(), t.String),
            fcl.arg(SignatureAlgorithm.toCadence(sigAlgo), t.UInt8),
            fcl.arg(HashAlgorithm.toCadence(hashAlgorithm), t.UInt8),
            fcl.arg(prepareCollectionMetadata(imports.MetadataViews, collectionMetadata), t.Identity),
            fcl.arg(royaltyAddresses, t.Array(t.Address)),
            fcl.arg(royaltyReceiverPaths, t.Array(t.Path)),
            fcl.arg(royaltyCuts, t.Array(t.UFix64)),
            fcl.arg(royaltyDescriptions, t.Array(t.String)),
            fcl.arg(saveAdminResourceToContractAccount ?? false, t.Bool),
          ],
          computeLimit: 9999,
          signers: this.getSigners(),
        };
      },
      ({ events }: TransactionResult) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const accountCreatedEvent = events.find((event) => event.type === 'flow.AccountCreated')!;

        const address = accountCreatedEvent.data['address'];

        this.setAddress(address);

        return address;
      },
    );
  }

  mintNFTs(metadata: MetadataMap[]): Transaction<NFTMintResult[]> {
    return new Transaction(
      ({ imports }: FreshmintConfig) => {
        const script = StandardNFTGenerator.mint({
          imports,
          contractName: this.name,
          contractAddress: this.getAddress(),
          schema: this.schema,
        });

        return {
          script,
          args: [
            ...this.schema.fields.map((field) => {
              return fcl.arg(
                metadata.map((values) => field.getValue(values)),
                t.Array(field.asCadenceTypeObject()),
              );
            }),
          ],
          computeLimit: 9999,
          signers: this.getSigners(),
        };
      },
      (result) => this.formatMintResults(result, metadata),
    );
  }

  private formatMintResults({ events, transactionId }: TransactionResult, metadata: MetadataMap[]): NFTMintResult[] {
    const deposits = events.filter((event) => event.type.includes('.Minted'));

    return deposits.map((deposit, i) => {
      return {
        id: deposit.data.id,
        metadata: metadata[i],
        transactionId,
      };
    });
  }
}
