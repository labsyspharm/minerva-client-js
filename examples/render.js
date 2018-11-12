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

const titleRet = label => response => {
  console.log('=== ' + label + ' ===');
  console.log();
  return response;
}

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

// Get an image
const imageUuid = 'e5544207-349c-454b-a00d-d83eea9d5200';
const imageDimensions = client.getImageDimensions(imageUuid)
  .then(printRet('Get Image Dimensions'));

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
  .then(titleRet('Render a Tile'))
  .then(body => {
    const wstream = fs.createWriteStream('tile.png');
    body.on('data', chunk => {
         wstream.write(chunk);
      }).on('end', () => {
         wstream.end();
      });
  })
  .catch(err => {
    console.error(err);
  });

// Render a region
const renderedRegion = imageDimensions
  .then(response => {
    return client.getImageRegionRendered(response['data']['image_uuid'], {
      x: 200,
      y: 400,
      width: 800,
      height: 600,
      z: 0,
      t: 0,
      channels: [
        { id: 0, color: 123456, min: 0.05, max: 0.2 },
        { id: 1, color: 234567, min: 0.05, max: 0.2 }
      ],
      outputWidth: 400,
      outputHeight: 300,
      preferHigherResolution: false
    });
  })
  .then(titleRet('Render a region'))
  .then(body => {
    const wstream = fs.createWriteStream('region.png');
    body.on('data', chunk => {
         wstream.write(chunk);
      }).on('end', () => {
         wstream.end();
      });
  })
  .catch(err => {
    console.error(err);
  });
