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


  _getBasicAttributesObject(){
    return this._objectRepresentation['x:xmpmeta']['rdf:RDF']['rdf:Description']['_attributes']
  }


  hasSettings(){
    let ba = this._getBasicAttributesObject();
    return ba['crs:HasSettings'] === 'True'
  }


  getRawFileName(){
    let ba = this._getBasicAttributesObject();
    return ba['crs:RawFileName']
  }


  setRawFileName(name){
    let ba = this._getBasicAttributesObject();
    ba['crs:RawFileName'] = name;
  }


  getSettingAttribute(attrName){
    let ba = this._getBasicAttributesObject();
    if(`crs:${attrName}` in ba){
      return ba[`crs:${attrName}`]
    }else{
      return null
    }
  }

  
  setSettingAttrubute(attrName, value){

  }

}

var index = { AdobeXmp };

module.exports = index;
//# sourceMappingURL=duskrcore.js.map
