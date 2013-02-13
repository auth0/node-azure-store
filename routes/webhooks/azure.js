var winston = require('winston'),
    utils = require('./utils'),
    async = require('async'),
    crypto = require('crypto'),
    moment = require('moment'),
    xmlBodyParser = require('xmlBodyParser').xmlBodyParser;

var utils = require('./utils');

var tempdata = require('./db/tempdata'),
    tenants = require('./db/tenants');

function loadRoutes(app) {
  app.post('/webhooks/azure/subscriptions/:subscription_id/Events', xmlBodyParser, suscription, errorHandler);
  app.put('/webhooks/azure/subscriptions/:subscription_id/cloudservices/:cloud_service_name/resources/:resource_type/:resource_name', xmlBodyParser, createOrUpdateResource, errorHandler);
  app.del('/webhooks/azure/subscriptions/:subscription_id/cloudservices/:cloud_service_name/resources/:resource_type/:resource_name', xmlBodyParser, removeResource, errorHandler);
  app.get('/webhooks/azure/subscriptions/:subscription_id/cloudservices/:cloud_service_name/resources/:resource_type/:resource_name', xmlBodyParser, getResource, errorHandler);
  app.get('/webhooks/azure/subscriptions/:subscription_id/cloudservices/:cloud_service_name', xmlBodyParser, getResource, errorHandler);
  
  // sso
  app.post('/webhooks/azure/subscriptions/:subscription_id/cloudservices/:cloud_service_name/resources/:resource_type/:resource_name/SsoToken', xmlBodyParser, getToken, ssoErrorHandler);
}

function errorHandler(err, req, res, next) {
  winston.error('azure: unhandled error:', err.toString());
  res.json(500, err.toString());
}

function ssoErrorHandler(err, req, res, next) {
  winston.error('azure: sso error: ', err.toString());
  res.send(403, err.toString());
}

function getPropertyFromSubscription(reqJSON, propName){
  var emails = reqJSON.EntityEvent.Properties[0].EntityProperty
        .filter(function (prop) {
          return prop.PropertyName[0] === propName;
        }).map(function (prop) {
          return prop.PropertyValue[0];
        });

  return emails;
}

function suscription(req, res, next) {
  winston.debug('registering subscription', { subscription_id: req.params['subscription_id'] });

  var state = req.body.EntityEvent.EntityState[0];
  switch (state) {
    case 'Registered':
      onSubscriptionRegistered(req, res, next);
      break;
    case 'Disabled':
      onSubscriptionDisabled(req, res, next);
      break;
    case 'Enabled':
      onSubscriptionEnabled(req, res, next);
      break;
    case 'Deleted':
      onSubscriptionDeleted(req, res, next);
      break;
  }
}

function onSubscriptionRegistered(req, res, next) {
  var hookData = {
    subscription_id: req.params['subscription_id'],
    email: getPropertyFromSubscription(req.body, 'EMail'),
    optin: getPropertyFromSubscription(req.body, 'OptIn')
  };

  tempdata.create(hookData, function(err) {
      if (err) {
        return next(err);
      }

      res.send(200, '');
  });
}

function onSubscriptionDisabled(req, res, next) {
  tenants.disableBy({ "azure.subscription_id": req.params['subscription_id'] }, function(err) {
    if (err) return next(err);

    res.send(200, '');
  });
}

function onSubscriptionEnabled(req, res, next) {
  tenants.enableBy({ "azure.subscription_id": req.params['subscription_id'] }, function(err) {
    if (err) return next(err);

    res.send(200, '');
  });
}

function onSubscriptionDeleted(req, res, next) {
  tenants.getBy({ "azure.subscription_id": req.params['subscription_id'] }, function(err, tenants) {
    if (err) return next(err);

    function remove(tenant, cb) {
      tenants.remove(tenant.slug, cb);
    }

    async.forEach(tenants, remove, function(err, results) {
      res.send(200, '');
    });
  });
}

function createOrUpdateResource(req, res, next) {
  winston.debug('azure: create or update', { body: req.body, params: req.params['subscription_id'] });

  var criteria = {
    "azure.subscription_id": req.params['subscription_id'],
    "azure.cloud_service_name": req.params['cloud_service_name'],
    "azure.resource_name": req.params['resource_name']
  };
  
  tenants.getBy(criteria, function(err, resources) {
    if (err) return next(err);

    if (!resources || resources.length === 0) {
      winston.debug('azure: creating resource', req.body);
      createResource(req.params['subscription_id'], req.params['cloud_service_name'], req.params['resource_name'], req.body.Resource.ETag[0], function(err, resource) {
        if (err) return next(err);

        renderResponse(resource, function(err, response) {
          if (err) return next(err);

          res.setHeader('Content-Type', 'application/xml');
          return res.send(200, response);
        });
      });
    } else {
      var tenant = resources[0];
      winston.debug('azure: updating resource', tenant);
      // TODO: this is a chance to update the output items shown in connection info on Azure
      // by returning a different ETag if something changed from the provider side
      // tenant.ETag = 'new-etag-signaling-change'

      renderResponse(resource, function(err, response) {
        if (err) return next(err);

        res.setHeader('Content-Type', 'application/xml');
        return res.send(200, response);
      });
    }
  });
}

function renderResponse(resource, callback) {
  winston.debug('azure: render create update res', resource);

  var data = {
    resource_name: resource.azure.resource_name,
    ETag: resource.azure.etag
    // extra parameters you want to send in OutputItems
  };

  return callback(null, utils.loadTemplate('create.xml', data));
}

function createResource(subscription_id, cloud_service_name, resource_name, etag, callback) {
  var criteria = { subscription_id: subscription_id };
  tempdata.get(criteria, function(err, hookData) {
    if (err) return callback(err);

    if (!hookData) return callback(new Error('hook data is null for ' + subscription_id));

    // make sure tenant is not being used
    tenants.getNextAvailable(utils.slugify(resource_name), function(err, slug) {
      if (err) return callback(err);

      var tenant = {
        _id:  slug,
        slug: slug,
        azure: {
          etag: etag,
          subscription_id: subscription_id,
          cloud_service_name: cloud_service_name,
          resource_name: resource_name
        }
      };

      tenants.create(tenant, function (err, resource) {
        if (err) {
          winston.error('azure: create tenant', err);
          return callback(err);
        }

        return callback(null, resource);
      });
    });
  });
}

function getResource(req, res, next) {
  winston.debug('azure: get resource');
  
  var criteria = {
    'azure.subscription_id': req.params['subscription_id'],
    'azure.cloud_service_name': req.params['cloud_service_name']
  };
  if (req.params['resource_name']) criteria['azure.resource_name'] = req.params['resource_name'];

  tenants.getBy(criteria, function(err, resources) {
    if (err) return next(err);
    if (!resources) return res.send(404, '');

    winston.debug('azure: resources in db', resources.length);
    res.setHeader('Content-Type', 'application/xml');
    return res.send(200, utils.loadTemplate('get.xml', { resources: resources }));
  });
}

function removeResource(req, res, next) {
  winston.debug('azure: delete resource');
  
  var criteria = {
    'azure.subscription_id': req.params['subscription_id'],
    'azure.cloud_service_name': req.params['cloud_service_name']
  };
  if (req.params['resource_name']) criteria['azure.resource_name'] = req.params['resource_name'];

  tenants.getBy(criteria, function(err, resources) {
    if (err) return next(err);

    if (!resources || resources.length === 0) {
      return res.send(404, '');
    }
    
    function remove(tenant, cb) {
      tenants.remove(tenant.slug, cb);
    }

    async.forEach(resources, remove, function(err, results) {
      res.send(200, '');
    });

  });
}

function getToken(req, res, next) {
  var secret = process.env.AZURE_SSO_SECRET;
  var toSign = req.params['subscription_id'] + ':' +
            req.params['cloud_service_name'] + ':' +
            req.params['resource_type'] + ':' +
            req.params['resource_name'] + ':' +
            secret;

  var token = crypto.createHash("sha256").update(toSign).digest("hex");

  var response = utils.loadTemplate('sso.xml', { token: token, timestamp: moment().format() });
  winston.debug('azure: sso token response', response);
  res.setHeader('Content-Type', 'application/xml');
  return res.send(200, response);
}

module.exports = loadRoutes;