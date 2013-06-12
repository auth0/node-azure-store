Windows Azure Store template for Node.js apps
================

This is an express js template application that can be used as a reference to implement Windows Azure Store add-ons using node.js

https://github.com/WindowsAzure/azure-resource-provider-sdk

This template has been created factoring out what we did for [Auth0](http://auth0.com), so you are basically buying yourself 3 full days of your time.

## Install

Of course, you'll need to have [node.js](http://nodejs.org/) installed. Once you do:

    npm install
    make
    make config
    make tests

That will install dependencies, create a configuration file, and run the test suite.

## Testing

The template's tests will exercise the hooks that will do (not all but most of) the tests that dukaan does.

You can run them with `mocha`, like this:

    mocha

If you don't have `mocha` installed, install it like this:

    npm install -g mocha

## TODO

* Implement certificate-based authentication for the hooks

## Credits

  - [Matias Woloski](http://github.com/woloski) - [Auth0](http://auth0.com)

## License

MIT