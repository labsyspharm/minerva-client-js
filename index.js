const { CognitoUserPool,
         CognitoUserAttribute,
         CognitoUser,
         AuthenticationDetails } = require('amazon-cognito-identity-js');
const AWS = require('aws-sdk');

class Client {
  constructor(cognitoUserPoolId, clientId, baseUrl) {
    this.cognitoUserPool = new CognitoUserPool({
      UserPoolId : cognitoUserPoolId,
      ClientId : clientId
    });
    this.baseUrl = baseUrl;
  }

  authenticate(username, password) {

    // TODO Perhaps cognitoUser should be a class member and reused everywhere?
    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: this.cognitoUserPool
    });

    const authenticationDetails = new AuthenticationDetails({
      Username: username,
      Password: password
    });

    const auth = new Promise((resolve, reject) => {
        cognitoUser.authenticateUser(authenticationDetails, {
          onSuccess: result => resolve(result),
          onFailure: err => reject(err),
          mfaRequired: codeDeliveryDetails => reject(codeDeliveryDetails),
          newPasswordRequired: (fields, required) => reject({fields, required})
        });
      });

    this._token = auth
      .then(response => response.getIdToken().getJwtToken());
      // Could setCredentials here if that is useful
      // .then(setCredentials);

    return this._token;
  }

  completeNewPasswordChallenge(username, oldPassword, newPassword,
                               userAttributes) {
    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: this.cognitoUserPool
    });

    const authenticationDetails = new AuthenticationDetails({
      Username: username,
      Password: oldPassword
    });

    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: result => reject(result),
        onFailure: err => reject(err),
        mfaRequired: codeDeliveryDetails => reject(codeDeliveryDetails),
        newPasswordRequired: (fields, required) => resolve({fields, required})
      });
    })
      .then(({fields, required}) => {
        return new Promise((resolve, reject) => {
          cognitoUser.completeNewPasswordChallenge(
            newPassword,
            userAttributes,
            {
              onSuccess: data => resolve(data),
              onFailure: err => reject(err)
            }
          );
        });
      });
  }

  changePassword(username, oldPassword, newPassword) {
    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: this.cognitoUserPool
    });

    const authenticationDetails = new AuthenticationDetails({
      Username: username,
      Password: oldPassword
    });

    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: result => resolve(result),
        onFailure: err => reject(err),
        mfaRequired: codeDeliveryDetails => reject(codeDeliveryDetails),
        newPasswordRequired: (fields, required) => reject({fields, required})
      });
    })
      .then(() => {
        return new Promise((resolve, reject) => {
          cognitoUser.changePassword(
            oldPassword,
            newPassword,
            (err, result) => {
              if (err) {
                reject(err);
              }
              resolve(result);
            }
          );
        });
      });
  }

  // TODO Test these out
  // forgotPassword(username) {
  //   const cognitoUser = new CognitoUser({
  //     Username: username,
  //     Pool: this.cognitoUserPool
  //   });
  //
  //   return new Promise((resolve, reject) => {
  //     cognitoUser.forgotPassword({
  //       onSuccess: result => resolve(result),
  //       onFailure: err => reject(err)
  //     });
  //   })
  // }
  //
  // confirmPassword(username, verificationCode, newPassword) {
  //   const cognitoUser = new CognitoUser({
  //     Username: username,
  //     Pool: this.cognitoUserPool
  //   });
  //
  //   return new Promise((resolve, reject) => {
  //     cognitoUser.confirmPassword(
  //       verificationCode,
  //       newPassword,
  //       {
  //         onSuccess: resolve(),
  //         onFailure: reject(err)
  //       }
  //     );
  //   });
  // }

  // Fetch
  apiFetch(method, route, params=null, body=null, accept_png=false) {

    return this.token
      .then(token => {
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': token
        };

        if (accept_png) {
          headers['Accept'] = 'image/png'
        }

        let url = this.baseUrl + route;

        if (params !== null) {
          const queryParams = Object.keys(params)
            .map(key => key + '=' + params[key])
            .join('&');
          if (queryParams.length > 0) {
            url += '?' + queryParams;
          }
        }

        const args = {
          method,
          headers,
          mode: 'cors',
          cache: 'no-cache'
        };

        if (body !== null) {
          args['body'] = JSON.stringify(body)
        }

        return fetch(url, args)
          .then(response => {

            // Turn HTTP error responses into rejected promises
            if (!response.ok) {
              return response.text()
                .then(text => {
                  return Promise.reject('Error ' + response.status + ' ('
                                        + response.statusText + '): ' + text);
                });
            }

            if (accept_png) {
              return response.body;
            } else {
              return (response.status !== 204) ? response.json() : {};
            }
          });
      });
  }

  get token() {
    // TODO Handle unauthenticated or expired token
    return this._token;
  }

  createGroup(data) {
    return this.apiFetch('POST', '/group', null, data);
  }

  getGroup(uuid) {
    return this.apiFetch('GET', '/group' + uuid, null, null);
  }

  createMembership(group_uuid, user_uuid, data) {
    return this.apiFetch('POST', '/membership/' + group_uuid + '/' + user_uuid,
                         null, data);
  }

  // Get membership
  getMembership(group_uuid, user_uuid) {
    return this.apiFetch('GET', '/membership/' + group_uuid + '/' + user_uuid,
                         null, null);
  }

  // Update membership
  updateMembership(group_uuid, user_uuid, data) {
    return this.apiFetch('PUT', '/membership/' + group_uuid + '/' + user_uuid,
                         null, data);
  }

  // Delete membership
  deleteMembership(group_uuid, user_uuid) {
    return this.apiFetch('DELETE',
                         '/membership/' + group_uuid + '/' + user_uuid, null,
                         null);
  }

  // Create a repository
  createRepository(data) {
    return this.apiFetch('POST', '/repository', null, data);
  }

  // List repositories
  listRepositories() {
    return this.apiFetch('GET', '/repository', null, null);
  }

  // Get repository
  getRepository(uuid) {
    return this.apiFetch('GET', '/repository/' + uuid, null, null);
  }

  // Update repository
  updateRepository(uuid, data) {
    return this.apiFetch('PUT', '/repository/' + uuid, null, data);
  }

  // Delete repository
  deleteRepository(uuid) {
    return this.apiFetch('DELETE', '/repository/' + uuid, null, null);
  }

  // Create import
  createImport(data) {
    return this.apiFetch('POST', '/import', null, data);
  }

  // List imports for a repository
  listImportsInRepository(uuid) {
    return this.apiFetch('GET', '/repository/' + uuid + '/imports', null, null);
  }

  // Get import
  getImport(uuid) {
    return this.apiFetch('GET', '/import/' + uuid, null, null);
  }

  // Get import credentials
  getImportCredentials(uuid) {
    return this.apiFetch('GET', '/import/' + uuid + '/credentials', null, null);
  }

  // Import update
  // TODO Replace setImportComplete with this
  updateImport(uuid, data) {
    return this.apiFetch('PUT', '/import/' + uuid, null, data);
  }

  // List Filesets in Import
  listFilesetsInImport(uuid) {
    return this.apiFetch('GET', '/import/' + uuid + '/filesets', null, null);
  }

  // List keys in Fileset
  listKeysInFileset(uuid) {
    return this.apiFetch('GET', '/fileset/' + uuid + '/keys', null, null);
  }

  // List images for a Fileset
  listImagesInFileset(uuid) {
    return this.apiFetch('GET', '/fileset/' + uuid + '/images', null, null);
  }

  // Get Image
  getImageCredentials(uuid) {
    return this.apiFetch('GET', '/image/' + uuid, null, null);
  }

  // Get Image credentials
  getImageDimensions(uuid) {
    return this.apiFetch('GET', '/image/' + uuid + '/dimensions', null, null);
  }

  // Get rendered tile (x and y are tile grids)
  getImageTileRendered(uuid, data) {
    const { x, y, z, t, level, channels } = data;
    const channelPathParams = channels.map(channel => {
      return channel['id'] + ',' + channel['color'] + ',' + channel['min']
        + ',' + channel['max'];
    }).join('/');
    return this.apiFetch(
      'GET',
      '/image/' + uuid + '/render-tile/' + x + '/' + y + '/' + z + '/' + t
        + '/' + level + '/' + channelPathParams,
      null,
      null,
      true
    );
  }

  // Get rendered region (x and y are coordinates)
  getImageRegionRendered(uuid, data) {
    const { x, y, width, height, z, t, channels, outputWidth,
            outputHeight, preferHigherResolution } = data;
    const channelPathParams = channels.map(channel => {
      return channel['id'] + ',' + channel['color'] + ',' + channel['min']
        + ',' + channel['max'];
    }).join('/');

    const params = {};

    if (outputWidth) {
      params['output-width'] = outputWidth;
    }

    if (outputHeight) {
      params['output-height'] = outputHeight;
    }

    if (preferHigherResolution) {
      params['prefer-higher-resolution'] = preferHigherResolution.toString();
    }

    return this.apiFetch(
      'GET',
      '/image/' + uuid + '/render-region/' + x + '/' + y + '/' + width + '/'
        + height + '/' + z + '/' + t + '/' + channelPathParams,
      params,
      null,
      true
    );
  }

}

module.exports = {
  Client
}
