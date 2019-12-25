'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var XmlParser = _interopDefault(require('xml-js'));

class AdobeXmp {
  constructor(){
    this._xmlPayload = null;
    this._objectRepresentation = null;
  }

  setXmlPayload(xmlStr){
    this._xmlPayload = xmlStr;
    let jsonPayload = XmlParser.xml2json(xmlStr, {compact: true});
    this._objectRepresentation = JSON.parse(jsonPayload);
  }

  getXml(){
    return XmlParser.json2xml(JSON.stringify(this._objectRepresentation), {compact: true, ignoreComment: true, spaces: 4})
  }
}

var index = { AdobeXmp };

module.exports = index;
//# sourceMappingURL=duskrcore.js.map
