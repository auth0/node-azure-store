var request   = require('request'),
    assert   = require('assert'),
    fs      = require('fs'),
    async      = require('async'),
    path    = require('path'),
    parser = require('xmldom').DOMParser,
    xpath = require('xpath'),
    crypto = require('crypto');

var app = require('../app');

var baseUrl = 'http://localhost:3000';

describe("azure hook", function() {
  
  before(function(done){
    // initialize resources
    done();
  });

  after(function(done) {
    done();
  });

  it('can register subscription and create resource', function (done) {
    async.series([
      function register(cb) {
        var body = fs.readFileSync(path.join(__dirname, 'subscription_register.xml'), 'utf8');
        request.post({url: baseUrl + '/webhooks/azure/subscriptions/12345/Events',
                  body: body,
                  headers: { 'Content-Type': 'application/xml' } }, function(err, resp) {

          assert.equal(200, resp.statusCode);
          cb();
        });
      },
      function create_resource(cb) {
        var body = fs.readFileSync(path.join(__dirname, 'create.xml'), 'utf8');
        request.put({
          url:  baseUrl + '/webhooks/azure/subscriptions/12345/cloudservices/my-cloud-service/resources/authentication/popey',
          body: body,
          headers: { 'Content-Type': 'application/xml' }
        }, function (err, resp, body) {
          assert.equal(200, resp.statusCode);
          var doc = new parser().parseFromString(body);

          var name = xpath.select("//Name/text()", doc);
          var outputItemKeys = xpath.select("//OutputItems/OutputItem/Key/text()", doc);
          var outputItemValues = xpath.select("//OutputItems/OutputItem/Value/text()", doc);
          var plan = xpath.select("//Plan/text()", doc);

          // TODO: asserts

          cb(); done();
        });
      }
    ]);
  });

  it('can disable subscription', function (done) {
    async.series([
      function disable(cb) {
        var body = fs.readFileSync(path.join(__dirname, 'subscription_disable.xml'), 'utf8');
        request.post({url: baseUrl + '/webhooks/azure/subscriptions/12345/Events',
                      body: body,
                      headers: { 'Content-Type': 'application/xml' } }, function(err, resp) {

          assert.equal(200, resp.statusCode);
          cb();
        });
      },
      function(cb) {
        // assert db
        cb(); done();
      }
    ]);
  });

  it('can enable subscription', function (done) {
    async.series([
      function enable(cb) {
        var body = fs.readFileSync(path.join(__dirname, 'subscription_disable.xml'), 'utf8');
        request.post({url: baseUrl + '/webhooks/azure/subscriptions/12345/Events',
                      body: body,
                      headers: { 'Content-Type': 'application/xml' } }, function(err, resp) {

          assert.equal(200, resp.statusCode);
          cb();
        });
      },
      function(cb) {
        // assert db
        cb(); done();
      }
    ]);
  });

  it('create resource with same name under different subscriptions appends counter', function (done) {
    async.series([
      function register_ABCD_subscription(cb) {
        var body = fs.readFileSync(path.join(__dirname, 'subscription_register.xml'), 'utf8');
        request.post({url: baseUrl + '/webhooks/azure/subscriptions/ABCD/Events',
                  body: body,
                  headers: { 'Content-Type': 'application/xml' } }, function(err, resp) {

          // assert.equal(200, resp.statusCode);
          cb();
        });
      },
      function create_resource_with_same_name_for_ABCD_subscription(cb) {
        var body = fs.readFileSync(path.join(__dirname, 'create.xml'), 'utf8');
        request.put({
          url:  baseUrl + '/webhooks/azure/subscriptions/ABCD/cloudservices/my-cloud-service/resources/authentication/popey',
          body: body,
          headers: { 'Content-Type': 'application/xml' }
        }, function (err, resp, body) {
          // assert.equal(200, resp.statusCode);

          // var doc = new parser().parseFromString(body);
          // var name = xpath.select("//Name/text()", doc);
          // var outputItemValues = xpath.select("//OutputItems/OutputItem/Value/text()", doc);

          // TODO: asserts

          cb();
        });
      },
      function(cb) {
        // assert db
        cb(); done();
      }
    ]);
  });

  it('can show resource', function (done) {
    request.get({url: baseUrl + '/webhooks/azure/subscriptions/12345/cloudservices/my-cloud-service/resources/authentication/popey'},
      function(err, resp, body) {

      // var doc = new parser().parseFromString(body);
      // var name = xpath.select("//Resources/Resource/Name/text()", doc);

      // TODO: asserts

      // assert.equal(200, resp.statusCode);
      done();
    });
  });

  it('create another resource under same subscription (ABCD)', function (done) {
    async.series([
      function create_resource_under_ABCD_subscription(cb) {
        var body = fs.readFileSync(path.join(__dirname, 'create.xml'), 'utf8');
        request.put({
          url:  baseUrl + '/webhooks/azure/subscriptions/ABCD/cloudservices/my-cloud-service/resources/authentication/olivia',
          body: body,
          headers: { 'Content-Type': 'application/xml' }
        }, function (err, resp, body) {
          // assert.equal(200, resp.statusCode);
          cb();
        });
      },
      function(cb) {
        // TODO: asserts db
        cb(); done();
      }
    ]);
  });

  it('can show multiple resources for subscription (ABCD)', function (done) {
    request.get({url: baseUrl + '/webhooks/azure/subscriptions/ABCD/cloudservices/my-cloud-service'},
      function(err, resp, body) {
      assert.equal(200, resp.statusCode);

      var doc = new parser().parseFromString(body);
      var names = xpath.select("//Resources/Resource/Name/text()", doc);

      // TODO: asserts db

      done();
    });
  });

  it('can updgrade resource', function (done) {
    async.series([
      function upgrade_resource(cb) {
        var body = fs.readFileSync(path.join(__dirname, 'upgrade.xml'), 'utf8');
        request.put({
          url:  baseUrl + '/webhooks/azure/subscriptions/12345/cloudservices/my-cloud-service/resources/authentication/popey',
          body: body,
          headers: { 'Content-Type': 'application/xml' }
        }, function (err, resp, body) {
          // assert.equal(200, resp.statusCode);
          // var doc = new parser().parseFromString(body);

          // var name = xpath.select("//Name/text()", doc);
          // var plan = xpath.select("//Plan/text()", doc);

          // TODO: asserts plan upgrade
          cb();
        });
      },
      function(cb) {
        // TODO: check that the plan was actually committed to db
        cb(); done();
      }
    ]);
  });

  it('can delete resource', function (done) {
    async.series([
      function delete_resource(cb) {
        request.del({url: baseUrl + '/webhooks/azure/subscriptions/ABCD/cloudservices/my-cloud-service/resources/authentication/olivia'},
          function(err, resp, body) {

          assert.equal(200, resp.statusCode);
          cb();
        });
      },
      function(cb) {
        // TODO: asserts db
        cb(); done();
      }
    ]);
  });

  it('returns 404 if deleting an unexisting resource', function (done) {
      request.del({url: baseUrl + '/webhooks/azure/subscriptions/ABCD/cloudservices/my-cloud-service/resources/authentication/non-existing'},
        function(err, resp, body) {

        // assert.equal(404, resp.statusCode);
        done();
      });
  });

  it('can create SSO token for subscription (ABCD)', function (done) {
    var secret = 'shhhhhh-this-is-secret';
    process.env.AZURE_SSO_SECRET = secret; // this should match with the secret on your file, usually this would go to process.env or nconf
    request.post({url: baseUrl + '/webhooks/azure/subscriptions/12345/cloudservices/my-cloud-service/resources/authentication/popey/SsoToken'},
      function(err, resp, body) {
      assert.equal(200, resp.statusCode);

      var doc = new parser().parseFromString(body);

      var token = xpath.select("//Token/text()", doc);
      assert.ok(token[0].data);

      var toSign = '12345'+ ':' +
              'my-cloud-service' + ':' +
              'authentication' + ':' +
              'popey' + ':' +
              secret;

      var calculated = crypto.createHash("sha256").update(toSign).digest("hex");

      assert.equal(calculated, token);
      done();
    });
  });

});
