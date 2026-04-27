![Working!](https://img.shields.io/badge/Status-Working-brightgreen)

# Simple JSON/XML Web Data Connector

Built by [Keshia Rose](https://keshiarose.com)

This is a simple [Web Data Connector](https://tableau.github.io/webdataconnector/docs/) for JSON and XML files, text, and URLs.

URL: `https://json-xml-wdc.onrender.com/`

Simply paste in your URL or data or just drag and drop a file.

Next, choose which fields to bring in to Tableau. You can select or clear all or individual fields, or select the parent of a nested object to change the selection of all within in.

You can also add multiple tables if your data has different levels of granularity.

This WDC only allows pulling in data from one source. If you need to pull data from multiple sources it may be best to use the WDC multiple times or to create a [custom WDC](https://tableau.github.io/webdataconnector/docs/).

## Why did I build this?

Back in 2022, I noticed a lot of people in the Tableau community asking how to connect to very simple data endpoints. Mostly public data that might be refreshed every so often. The answer was usually to build your own WDC. While for some that may be a simple task, I felt like it shouldn't be necessary just to connect to a single data source for quick analysis.
When Tableau first launched Web Data Connectors, there was a sample that allowed you to connect to JSON endpoints. It was removed once they added the ability to connect to JSON files natively in the product. But that still left a gap: the ability to connect to simple URLs and XML. That's why I built this WDC. Hopefully, it can help people who want to analyze a simple endpoint (or file, or just some stuff they copied) do so without a heavy lift.

## Limitations

- Complex or super-nested data structures may fail
- Only pulls data from one URL endpoint, no pagination
- Data brought in from a file will not refresh, but URLs will
- No incremental extract refreshes

## How to deploy your own

I suggest deploying your own version of this WDC so you can have a dedicated application for your own use. Here are a few options for spinning up your own:

1. [Deploy it on Render](https://render.com/deploy?repo=https://github.com/KeshiaRose/json-xml-wdc)

Or you could host it locally by doing the following:

1. Install [Node.js](https://nodejs.org).
1. [Clone](https://github.com/KeshiaRose/JSON-XML-WDC) or download and unzip this repository.
1. Open the command line within the `JSON-XML-WDC` master folder and run `npm install` to install the node modules.
1. Then run `npm start` to start the web server or use something like [pm2](https://pm2.keymetrics.io/) for a production environment.

## How to refresh

##### Tableau Server
If you want to use this WDC on your Tableau Server you will first need to [add it to your safelist](https://help.tableau.com/current/server/en-us/datasource_wdc.htm) with the following commands:
```
tsm data-access web-data-connectors add --name "JSON XML WDC" --url https://json-xml-wdc.onrender.com:443
tsm pending-changes apply
```
Note that this will require your Tableau Server to restart!

##### Tableau Online
If you want to use this WDC on Tableau Online you will need to set it up using [Tableau Bridge](https://help.tableau.com/current/online/en-us/qs_refresh_local_data.htm)

## Questions?
[Open an issue!](https://github.com/KeshiaRose/JSON-XML-WDC/issues/new)

#### Support

I gladly make this WDC available for free but if you would like to show some support you can [buy me some cheese🧀](https://www.buymeacoffee.com/KeshiaRose)!
