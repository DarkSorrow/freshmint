import NonFungibleToken from {{{ imports.NonFungibleToken }}}
import FungibleToken from {{{ imports.FungibleToken }}}

pub contract NFTLockBox {

    // This event is emitted when an NFT is claimed
    // from a lock box.
    pub event Claimed(
        nftType: Type,
        nftID: UInt64,
        from: Address?,
        recipient: Address
    )

    pub let DefaultLockBoxStoragePath: StoragePath
    pub let DefaultLockBoxPublicPath: PublicPath

    pub resource interface LockBoxPublic {
        pub fun claim(
            id: UInt64, 
            address: Address,
            signature: [UInt8]
        )
    }

    pub resource LockBox: LockBoxPublic {

        // A capability to the underlying base NFT collection
        // that will store the claimable NFTs.
        access(self) let collection: Capability<&{NonFungibleToken.Provider, NonFungibleToken.Receiver}>
        
        // When moving a claimed NFT in an account,
        // the lock box will deposit the NFT into 
        // the NonFungibleToken.Receiver linked at this public path.
        access(self) let receiverPath: PublicPath

        // A map of public keys, indexed by NFT ID,
        // used to verify claim signatures.
        access(self) let publicKeys: {UInt64: [UInt8]}

        init(
            collection: Capability<&{NonFungibleToken.Provider, NonFungibleToken.Receiver}>,
            receiverPath: PublicPath
        ) {
            self.collection = collection
            self.receiverPath = receiverPath

            self.publicKeys = {}
        }

        // Deposit an NFT into this lock box and make it claimable.
        //
        // After deposit, the NFT can be claimed with a signature
        // from the private key that corresponds to the provided public key.
        pub fun deposit(token: @NonFungibleToken.NFT, publicKey: [UInt8]) {
            let collection = self.collection.borrow()!

            self.publicKeys[token.id] = publicKey

            collection.deposit(token: <- token)
        }

        // Claim an NFT by ID using a claim signature and
        // deliver it to the provided address.
        //
        // If the NFT exists and the signature is valid,
        // this function will deposit the NFT into the account
        // with the provided address. 
        //
        // The account must expose a public NonFungibleToken.Receiver
        // capability at `self.receiverPath` that can accept NFTs
        // of this type.
        //
        // A signature is generated by signing:
        //
        //   SHA3_256(
        //     "FLOW-V0.0-user" + BYTES(ADDRESS) + BIG_ENDIAN_BYTES(ID)
        //   )
        //
        pub fun claim(
            id: UInt64, 
            address: Address,
            signature: [UInt8]
        ) {
            let collection = self.collection.borrow()!

            // We withdraw the NFT before verifying the signature
            // in order to fail as early as possible if the NFT
            // does not exist in this collection.
            let nft <- collection.withdraw(withdrawID: id)
            let nftType = nft.getType()

            let rawPublicKey = self.publicKeys.remove(key: id) 
                ?? panic("NFT is not claimable or has already been claimed")

            let publicKey = PublicKey(
                publicKey: rawPublicKey,
                signatureAlgorithm: SignatureAlgorithm.ECDSA_P256
            )

            let message = self.makeClaimMessage(address: address, id: id)

            let isValidClaim = publicKey.verify(
                signature: signature,
                signedData: message,
                domainSeparationTag: "FLOW-V0.0-user",
                hashAlgorithm: HashAlgorithm.SHA3_256
            )

            assert(isValidClaim, message: "invalid claim signature")

            let receiver = getAccount(address)
                .getCapability(self.receiverPath)
                .borrow<&{NonFungibleToken.Receiver}>()!

            receiver.deposit(token: <- nft)

            emit Claimed(
                nftType: nftType,
                nftID: id,
                from: self.owner?.address,
                recipient: address
            )
        }

        pub fun makeClaimMessage(address: Address, id: UInt64): [UInt8] {
            let addressBytes = address.toBytes()
            let idBytes = id.toBigEndianBytes()

            return addressBytes.concat(idBytes)
        }
    }

    pub fun createLockBox(
        collection: Capability<&{NonFungibleToken.Provider, NonFungibleToken.Receiver}>,
        receiverPath: PublicPath
    ): @LockBox {
        return <- create LockBox(collection: collection, receiverPath: receiverPath)
    }

    init() {
        self.DefaultLockBoxStoragePath = /storage/NFTLockBox
        self.DefaultLockBoxPublicPath = /public/NFTLockBox
    }
}
