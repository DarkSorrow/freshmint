import NonFungibleToken from "./NonFungibleToken.cdc"

pub contract NextToken: NonFungibleToken {

    // Events
    //
    pub event ContractInitialized()
    pub event Withdraw(id: UInt64, from: Address?)
    pub event Deposit(id: UInt64, to: Address?)
    pub event Minted(id: UInt64)

    // Named Paths
    //
    pub let CollectionStoragePath: StoragePath
    pub let CollectionPublicPath: PublicPath
    pub let MinterStoragePath: StoragePath

    // totalSupply
    // The total number of NextToken that have been minted
    //
    pub var totalSupply: UInt64

    pub resource NFT: NonFungibleToken.INFT {

        pub let id: UInt64

        // The IPFS CID of the metadata file.
        pub let metadata: String

        init(id: UInt64, metadata: String) {
            self.id = id
            self.metadata = metadata
        }
    }

    pub resource interface NextTokenCollectionPublic {
        pub fun deposit(token: @NonFungibleToken.NFT)
        pub fun getIDs(): [UInt64]
        pub fun borrowNFT(id: UInt64): &NonFungibleToken.NFT
        pub fun borrowNextToken(id: UInt64): &NextToken.NFT? {
            post {
                (result == nil) || (result?.id == id):
                    "Cannot borrow NextToken reference: The ID of the returned reference is incorrect"
            }
        }
    }

    pub resource Collection: NextTokenCollectionPublic, NonFungibleToken.Provider, NonFungibleToken.Receiver, NonFungibleToken.CollectionPublic {
        
        // dictionary of NFTs
        // NFT is a resource type with an `UInt64` ID field
        //
        pub var ownedNFTs: @{UInt64: NonFungibleToken.NFT}

        // withdraw
        // Removes an NFT from the collection and moves it to the caller
        //
        pub fun withdraw(withdrawID: UInt64): @NonFungibleToken.NFT {
            let token <- self.ownedNFTs.remove(key: withdrawID) ?? panic("missing NFT")

            emit Withdraw(id: token.id, from: self.owner?.address)

            return <-token
        }

        // deposit
        // Takes a NFT and adds it to the collections dictionary
        // and adds the ID to the id array
        //
        pub fun deposit(token: @NonFungibleToken.NFT) {
            let token <- token as! @NextToken.NFT

            let id: UInt64 = token.id

            // add the new token to the dictionary which removes the old one
            let oldToken <- self.ownedNFTs[id] <- token

            emit Deposit(id: id, to: self.owner?.address)

            destroy oldToken
        }

        // getIDs
        // Returns an array of the IDs that are in the collection
        //
        pub fun getIDs(): [UInt64] {
            return self.ownedNFTs.keys
        }

        // borrowNFT
        // Gets a reference to an NFT in the collection
        // so that the caller can read its metadata and call its methods
        //
        pub fun borrowNFT(id: UInt64): &NonFungibleToken.NFT {
            return &self.ownedNFTs[id] as &NonFungibleToken.NFT
        }

        // borrowNextToken
        // Gets a reference to an NFT in the collection as a NextToken,
        // exposing all of its fields (including the typeID).
        // This is safe as there are no functions that can be called on the KittyItem.
        //
        pub fun borrowNextToken(id: UInt64): &NextToken.NFT? {
            if self.ownedNFTs[id] != nil {
                let ref = &self.ownedNFTs[id] as auth &NonFungibleToken.NFT
                return ref as! &NextToken.NFT
            } else {
                return nil
            }
        }

        // destructor
        destroy() {
            destroy self.ownedNFTs
        }

        // initializer
        //
        init () {
            self.ownedNFTs <- {}
        }
    }

    // createEmptyCollection
    // public function that anyone can call to create a new empty collection
    //
    pub fun createEmptyCollection(): @NonFungibleToken.Collection {
        return <- create Collection()
    }

    // NFTMinter
    // Resource that an admin or something similar would own to be
    // able to mint new NFTs
    //
	pub resource NFTMinter {

		// mintNFT
        // Mints a new NFT with a new ID
		// and deposit it in the recipients collection using their collection reference
        //
		pub fun mintNFT(recipient: &{NonFungibleToken.CollectionPublic}, metadata: String) {
            emit Minted(id: NextToken.totalSupply)

			// deposit it in the recipient's account using their reference
			recipient.deposit(token: <-create NextToken.NFT(id: NextToken.totalSupply, metadata: metadata))

            NextToken.totalSupply = NextToken.totalSupply + (1 as UInt64)
		}
	}

    // fetch
    // Get a reference to a NextToken from an account's Collection, if available.
    // If an account does not have a NextToken.Collection, panic.
    // If it has a collection but does not contain the itemID, return nil.
    // If it has a collection and that collection contains the itemID, return a reference to that.
    //
    pub fun fetch(_ from: Address, itemID: UInt64): &NextToken.NFT? {
        let collection = getAccount(from)
            .getCapability(NextToken.CollectionPublicPath)!
            .borrow<&{ NextToken.NextTokenCollectionPublic }>()
            ?? panic("Couldn't get collection")
        // We trust NextToken.Collection.borowNextToken to get the correct itemID
        // (it checks it before returning it).
        return collection.borrowNextToken(id: itemID)
    }

    // initializer
    //
	init() {
        // Set our named paths
        self.CollectionStoragePath = /storage/NextTokenCollection
        self.CollectionPublicPath = /public/NextTokenCollection
        self.MinterStoragePath = /storage/NextTokenMinter

        // Initialize the total supply
        self.totalSupply = 0

        // Create a Minter resource and save it to storage
        let minter <- create NFTMinter()
        self.account.save(<-minter, to: self.MinterStoragePath)

        emit ContractInitialized()
	}
}
