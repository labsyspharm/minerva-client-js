# minerva-client-js
Minerva Javascript client library

This client library uses Promises.

Example usage:

#### Initialise the client

```js
const { CognitoUserPool,
         CognitoUserAttribute,
         CognitoUser,
         AuthenticationDetails } = require('amazon-cognito-identity-js');
const AWS = require('aws-sdk');
const fs = require('fs');
const { Client } = require('./minerva_client');

const client = new Client(
  'cognitoUserPoolId',
  'clientId',
  'baseUrl'
);

client.authenticate('username@example.com', 'password');
```

#### Using fetch in node
To enable fetch to run on node (as opposed to in the browser):

```js
global.fetch = require('node-fetch')
global.navigator = {};
```

#### Create repository/import/etc

```js
// Utility function to print results and pass along the response
const printRet = label => response => {
  console.log('=== ' + label + ' ===');
  console.log(response);
  console.log();
  return response;
};

// Create repository
const repository = client.createRepository({
  'name': 'Repository' + id,
  'raw_storage': 'Destroy'
})
  .then(printRet('Create Repository'));

// Create an import
const import_ = repository
  .then(response => {
    return client.createImport({
      'name': 'Import' + id,
      'repository_uuid': response['data']['uuid']
    });
  })
  .then(printRet('Create Import'));

// List imports in repository
Promise.all([repository, import_])
  .then(([response]) => {
    return client.listImportsInRepository(response['data']['uuid']);
  })
  .then(printRet('List Imports in Repository'));

// Get the import credentials
const importCredentials = import_
  .then(response => {
    return client.getImportCredentials(response['data']['uuid']);
  })
  .then(printRet('Get Import Credentials'));

// Use the temporary credentials to upload a file
const importUpload = importCredentials
  .then(response => {
    const credentials = new AWS.Credentials(
      response['credentials']['AccessKeyId'],
      response['credentials']['SecretAccessKey'],
      response['credentials']['SessionToken']
    );
    const s3 = new AWS.S3({
      credentials
    });
    const r = /^s3:\/\/([A-z0-9\-]+)\/([A-z0-9\-]+\/)$/;
    const m = r.exec(response['url'])
    const bucket = m[1];
    const prefix = m[2];

    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(
        '/testproject1/example.rcpnl'
      );
      fileStream.on('error', reject);

      s3.putObject(
        {
          Body: fileStream,
          Bucket: bucket,
          Key: prefix + '/testproject1/example.rcpnl'
        },
        (err, response) => err ? reject(err) : resolve(response)
      );
    });
  })
  .then(printRet('Upload file'));

// Use the temporary credentials to list the import prefix
const importContents = Promise.all([importCredentials, importUpload])
  .then(([response]) => {
    const credentials = new AWS.Credentials(
      response['credentials']['AccessKeyId'],
      response['credentials']['SecretAccessKey'],
      response['credentials']['SessionToken']
    );
    const s3 = new AWS.S3({
      credentials
    });
    const r = /^s3:\/\/([A-z0-9\-]+)\/([A-z0-9\-]+\/)$/;
    const m = r.exec(response['url'])
    const bucket = m[1];
    const prefix = m[2];
    return new Promise((resolve, reject) => {
      s3.listObjectsV2(
        {
          Bucket: bucket,
          Prefix: prefix
        },
        (err, response) => err ? reject(err) : resolve(response)
      );
    });

  })
  .then(printRet('List Import Bucket'));

// Set the import complete
const importComplete = Promise.all([import_, importUpload])
  .then(([response]) => {
    return client.updateImport(response['data']['uuid'], {'complete': true});
  })
  .then(printRet('Set Import Complete'));

// Wait for the import to be processed and have a BFU
const bfu = Promise.all([import_, importComplete])
  .then(([response]) => {
    return new Promise((resolve, reject) => {
      const wait_for_a_bfu = () => {
        client.listBFUsInImport(response['data']['uuid'])
          .then(response => {
            if (response['data'].length > 0
                && response['data'][0]['complete'] === true) {
              resolve(response['data'][0]);
            } else {
              setTimeout(wait_for_a_bfu, 30000);
            }
          });
      };
      wait_for_a_bfu();
    });
  });

// Get an image associated with the BFU
const image = bfu
  .then(response => {
    return client.listImagesInBFU(response['data']['uuid'])
  })
  .then(response => response['data'][0])
  .then(printRet*('Get Image'));

// Get the image credentials
const imageCredentials = image
  .then(response => {
    return client.getImageCredentials(response['data']['uuid']);
  })
  .then(printRet('Get Image Credentials'));

const imageDimensions = image
  .then(response => {
    return client.getImageDimensions(response['data']['uuid']);
  })
  .then(printRet('Get Image Dimensions'));
```

#### Render Tile
Get details of an image and then render a tile for the given settings to
test.png.

```js
// Get an image by a known ID
const imageUuid = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
const imageDimensions = client.getImageDimensions(imageUuid);

// Render a tile
const renderedTile = imageDimensions
  .then(response => {
    return client.getImageTileRendered(response['data']['image']['uuid'], {
      x: 0,
      y: 0,
      z: 0,
      t: 0,
      level: 0,
      channels: [
        { id: 0, color: 123456, min: 0.05, max: 0.2 },
        { id: 1, color: 234567, min: 0.05, max: 0.2 }
      ]
    });
  })
  .then(body => {
    const wstream = fs.createWriteStream('test.png');
    body.on('data', chunk => {
         wstream.write(chunk);
      }).on('end', () => {
         wstream.end();
      });
  });
```

#### Complete New Password Challenge
If a user is required to change a password on login, this can be used to do so.

```js
return client.completeNewPasswordChallenge(
  'username@example.com',
  'oldPassword'
  'newPassword',
  {
    preferred_username: 'preferredUsername',
    name: 'Full Name'
  }
)
  .catch(err => {
    console.error(err);
  });
```
