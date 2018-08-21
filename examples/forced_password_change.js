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
  console.log(response);
  console.log();
  return response;
};

const errExit = label => data => {
  console.error('EEE ' + label + ' EEE');
  console.error(data);
  console.error();
  process.exit();
};

const client = new Client(
  config['PoolId'],
  config['AppClientId'],
  config['ApiBaseUrl']
);

client.completeNewPasswordChallenge(
  config['Username'],
  config['TemporaryPassword'],
  config['Password'],
  {
    preferred_username: config['PreferredUsername'],
    name: config['Name']
  }
)
  .then(printRet('Password change'))
  .catch(errExit('Password change'));
