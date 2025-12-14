Assets

Assets are dynamic records that store data about a shared asset. For example, our image and video shapes refer to assets rather than embedding their source files directly. Asset storage and retrieval is controlled by TLAssetStore. Different TLStore setups require different asset setups:

    By default, the store is in-memory only, so inlineBase64AssetStore converts images to data URLs.
    When using the persistenceKey prop, the store is synced to the browser's local IndexedDB, so we store images there too.
    When using a multiplayer sync server, you would implement TLAssetStore to upload images to e.g. an S3 bucket.
