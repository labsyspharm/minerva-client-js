# minerva-client-js
Minerva Javascript client library

This client library uses Promises.

Example usage:

#### Using fetch in node
To enable fetch to run on node (as opposed to in the browser):

```js
global.fetch = require('node-fetch')
global.navigator = {};
```

#### Exploratory Utility functions
```js
// Utility function to print response and pass it along
const printRet = label => response => {
  console.log('=== ' + label + ' ===');
  console.log(JSON.stringify(response, null, 4));
  console.log();
  return response;
};

// Utility function to print error and exit
const errExit = label => data => {
  console.error('EEE ' + label + ' EEE');
  console.error(data);
  console.error();
  process.exit();
};

// Utility function to get just the data key from a response
const justData = response => response['data'];
```

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

client.authenticate('username@example.com', 'password')
  .catch(errExit('Authenticating'));
```

#### Create repository/import/etc
Create a repository and then an import within it. Get credentials to
upload to the import and upload an example image. Complete the import
and wait for a Fileset within to be marked as complete. Get details of an
image within that Fileset.

```js
// Names need to be unique, for this demonstration use a unique ID
// for each run
const id = 1;

// Create repository
const repository = client.createRepository({
  'name': 'Repository' + id,
  'raw_storage': 'Destroy'
})
  .then(printRet('Create Repository'))
  .then(justData)
  .catch(errExit('Create Repository'))

// Create an import
const import_ = repository
  .then(data => {
    return client.createImport({
      'name': 'Import' + id,
      'repository_uuid': data['uuid']
    });
  })
  .then(printRet('Create Import'))
  .then(justData)
  .catch(errExit('Create Import'));

// List imports in repository
Promise.all([repository, import_])
  .then(([data]) => {
    return client.listImportsInRepository(data['uuid']);
  })
  .then(printRet('List Imports in Repository'))
  .catch(errExit('List Imports in Repository'));

// Get the import credentials
const importCredentials = import_
  .then(data => {
    return client.getImportCredentials(data['uuid']);
  })
  .then(printRet('Get Import Credentials'))
  .then(justData)
  .catch(errExit('Get Import Credentials'));

// Use the temporary credentials to upload a file
const importUpload = importCredentials
  .then(data => {
    const credentials = new AWS.Credentials(
      data['credentials']['AccessKeyId'],
      data['credentials']['SecretAccessKey'],
      data['credentials']['SessionToken']
    );
    const s3 = new AWS.S3({
      credentials
    });
    const r = /^s3:\/\/([A-z0-9\-]+)\/([A-z0-9\-]+\/)$/;
    const m = r.exec(data['url'])
    const bucket = m[1];
    const prefix = m[2];

    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(
        '/path/to/data/dataset1/image1.rcpnl'
      );
      fileStream.on('error', reject);

      s3.putObject(
        {
          Body: fileStream,
          Bucket: bucket,
          Key: prefix + '/dataset1/image1.rcpnl'
        },
        (err, data) => err ? reject(err) : resolve(data)
      );
    })
  })
  .then(printRet('Upload file'))
  .catch(errExit('Upload file'));

// Use the temporary credentials to list the import prefix
const importContents = Promise.all([importCredentials, importUpload])
  .then(([data]) => {
    const credentials = new AWS.Credentials(
      data['credentials']['AccessKeyId'],
      data['credentials']['SecretAccessKey'],
      data['credentials']['SessionToken']
    );
    const s3 = new AWS.S3({
      credentials
    });
    const r = /^s3:\/\/([A-z0-9\-]+)\/([A-z0-9\-]+\/)$/;
    const m = r.exec(data['url'])
    const bucket = m[1];
    const prefix = m[2];
    return new Promise((resolve, reject) => {
      s3.listObjectsV2(
        {
          Bucket: bucket,
          Prefix: prefix
        },
        (err, data) => err ? reject(err) : resolve(data)
      );
    });

  })
  .then(printRet('List Import Bucket'))
  .catch(errExit('List Import Bucket'));

// Set the import complete
const importComplete = Promise.all([import_, importUpload])
  .then(([data]) => {
    return client.updateImport(data['uuid'], {'complete': true});
  })
  .then(printRet('Set Import Complete'))
  .then(justData)
  .catch(errExit('Set Import Complete'));

// Wait for the import to be processed and have a Fileset
const fileset = Promise.all([import_, importComplete])
  .then(([data]) => {
    return new Promise((resolve, reject) => {
      const wait_for_a_fileset = () => {
        client.listFilesetsInImport(data['uuid'])
          .then(justData)
          .then(data => {
            if (data.length > 0
                && data[0]['complete'] === true) {
              resolve(data[0]);
            } else {
              setTimeout(wait_for_a_fileset, 30000);
            }
          });
      };
      wait_for_a_fileset();
    });
  })
  .then(printRet('Wait for Fileset'))
  .catch(errExit('Wait for Fileset'));

// Get an image associated with the Fileset
const image = fileset
  .then(data => {
    return client.listImagesInFileset(data['uuid'])
  })
  .then(justData)
  .then(data => data[0])
  .then(printRet('Get Image'))
  .catch(errExit('Get Image'));

// Get the image credentials
const imageCredentials = image
  .then(data => {
    return client.getImageCredentials(data['uuid']);
  })
  .then(printRet('Get Image Credentials'))
  .then(justData)
  .catch(errExit('Get Image Credentials'));

// Get the image dimensions
const imageDimensions = image
  .then(data => {
    return client.getImageDimensions(data['uuid']);
  })
  .then(printRet('Get Image Dimensions'))
  .then(justData)
  .catch(errExit('Get Image Dimensions'));
```

#### Render Tile
Get details of an image and then render a tile for the given settings to
test.png.

```js
// Get an image by a known ID
const imageUuid = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
const imageDimensions = client.getImageDimensions(imageUuid)
  .then(printRet('Get Image Dimensions'))
  .catch(errExit('Get Image Dimensions'));

// Render a tile
const renderedTile = imageDimensions
  .then(response => {
    return client.getImageTileRendered(response['data']['image_uuid'], {
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
