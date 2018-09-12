global.fetch = require('node-fetch')
global.navigator = {};

const readYaml = require('read-yaml');
const { CognitoUserPool,
         CognitoUserAttribute,
         CognitoUser,
         AuthenticationDetails } = require('amazon-cognito-identity-js');
const AWS = require('aws-sdk');
const fs = require('fs');
const { Client } = require('../index');

const config = readYaml.sync(process.argv[2]);

// Utility function to print results and pass along the response
const printRet = label => response => {
  console.log('=== ' + label + ' ===');
  console.log(JSON.stringify(response, null, 2));
  console.log();
  return response;
};

const errExit = label => data => {
  console.error('EEE ' + label + ' EEE');
  console.error(JSON.stringify(data, null, 2));
  console.error();
  process.exit();
};

const region = config['Region'];

const client = new Client(
  config['PoolId'],
  config['AppClientId'],
  config['ApiBaseUrl']
);

const id = new Date().getTime();

client.authenticate(config['Username'], config['Password'])
  .catch(errExit('Authenticating'));

// Create repository
const repository = client.createRepository({
  'name': 'Repository' + id,
  'raw_storage': 'Destroy'
})
  .then(printRet('Create Repository'))
  .catch(errExit('Create Repository'))

// Create an import
const import_ = repository
  .then(response => {
    return client.createImport({
      'name': 'Import' + id,
      'repository_uuid': response['data']['uuid']
    });
  })
  .then(printRet('Create Import'))
  .catch(errExit('Create Import'));

// List imports in repository
Promise.all([repository, import_])
  .then(([response]) => {
    return client.listImportsInRepository(response['data']['uuid']);
  })
  .then(printRet('List Imports in Repository'))
  .catch(errExit('List Imports in Repository'));

// Get the import credentials
const importCredentials = import_
  .then(response => {
    return client.getImportCredentials(response['data']['uuid']);
  })
  .then(printRet('Get Import Credentials'))
  .catch(errExit('Get Import Credentials'));

// Use the temporary credentials to upload a file
const importUpload = importCredentials
  .then(response => {
    const credentials = new AWS.Credentials(
      response['data']['credentials']['AccessKeyId'],
      response['data']['credentials']['SecretAccessKey'],
      response['data']['credentials']['SessionToken']
    );
    const s3 = new AWS.S3({
      credentials,
      region
    });
    const r = /^s3:\/\/([A-z0-9\-]+)\/([A-z0-9\-]+\/)$/;
    const m = r.exec(response['data']['url'])
    const bucket = m[1];
    const prefix = m[2];

    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(
        '/Users/dpwrussell/Downloads/TestData/minerva/rcpnl/TONSIL-Scan_20160628_093314_01x4x00030.rcpnl'
      );
      fileStream.on('error', reject);

      s3.putObject(
        {
          Body: fileStream,
          Bucket: bucket,
          Key: prefix + '/rcpnl/TONSIL-Scan_20160628_093314_01x4x00030.rcpnl'
        },
        (err, response) => err ? reject(err) : resolve(response)
      );
    });
  })
  .then(printRet('Upload file'))
  .catch(errExit('Upload file'));

// Use the temporary credentials to list the import prefix
const importContents = Promise.all([importCredentials, importUpload])
  .then(([response]) => {
    const credentials = new AWS.Credentials(
      response['data']['credentials']['AccessKeyId'],
      response['data']['credentials']['SecretAccessKey'],
      response['data']['credentials']['SessionToken']
    );
    const s3 = new AWS.S3({
      credentials
    });
    const r = /^s3:\/\/([A-z0-9\-]+)\/([A-z0-9\-]+\/)$/;
    const m = r.exec(response['data']['url'])
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
  .then(printRet('List Import Bucket'))
  .catch(errExit('List Import Bucket'));

// Set the import complete
const importComplete = Promise.all([import_, importUpload])
  .then(([response]) => {
    return client.updateImport(response['data']['uuid'], {'complete': true});
  })
  .then(printRet('Set Import Complete'))
  .catch(errExit('Set Import Complete'));

// Wait for the import to be processed and have a Fileset
const fileset = Promise.all([import_, importComplete])
  .then(([response]) => {
    return new Promise((resolve, reject) => {
      const wait_for_a_fileset = () => {
        client.listFilesetsInImport(response['data']['uuid'])
          .then(response => {
            if (response['data'].length > 0
                && response['data'][0]['complete'] === true) {
              resolve(response);
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
  .then(response => {
    return client.listImagesInFileset(response['data'][0]['uuid'])
  })
  .then(printRet('Get Image'))
  .catch(errExit('Get Image'));

// Get the image credentials
const imageCredentials = image
  .then(response => {
    return client.getImageCredentials(response['data'][0]['uuid']);
  })
  .then(printRet('Get Image Credentials'))
  .catch(errExit('Get Image Credentials'));

const imageDimensions = image
  .then(response => {
    return client.getImageDimensions(response['data'][0]['uuid']);
  })
  .then(printRet('Get Image Dimensions'))
  .catch(errExit('Get Image Dimensions'));
