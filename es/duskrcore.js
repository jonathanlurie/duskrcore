import XmlParser from 'xml-js';

class AdobeXmp {

  /**
   * Val is a string, but it can represent a number, a boolean or a string.
   * This function converts val into the most appropriate type.
   * @param  {string} val - a value
   * @return {string|number|boolean}
   */
  static convertToRelevantType(val){
    let cleanVal = val.trim();
    // boolean: true
    if(cleanVal === 'True' || cleanVal === 'true' || cleanVal === 'TRUE')
      return true

    // boolean: false
    if(cleanVal === 'False' || cleanVal === 'false' || cleanVal === 'FALSE')
      return false

    // a number
    if(parseFloat(cleanVal) !== NaN)
      return parseFloat(cleanVal)

    // a string
    return cleanVal
  }


  static convertToString(val){
    if(val === true)
      return 'True'

    if(val === false)
      return 'False'

    if(typeof val === 'number')
      return val.toString()

    return val.trim()
  }



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
      return AdobeXmp.convertToRelevantType(ba[`crs:${attrName}`])
    }else{
      return null
    }
  }


  setSettingAttribute(attrName, value){
    let ba = this._getBasicAttributesObject();
    ba[`crs:${attrName}`] = AdobeXmp.convertToString(value);
  }

}

class AdobeXmpCollection {

  static findNumberSequence(filename){
    let splitChar = ' ';
    let numbersOnly = Array.from(filename).map(char => isNaN(parseInt(char)) ? splitChar : char)
      .join('')
      .split(splitChar)
      .filter(substr => substr !== '')
      .map(substr => parseInt(substr))
      .filter(substr => substr !== NaN);

    if(numbersOnly.length){
      let number = numbersOnly[0];
      let numberPosition = filename.indexOf(number);
      let prefix = filename.slice(0, numberPosition);
      let sufix = filename.slice(numberPosition + number.toString().length );
      return {
        number: number,
        prefix: prefix,
        sufix: sufix
      }
    }else{
      return null
    }
  }

  constructor(){
    this._controlPoints = {};
  }


  addControlPoint(filename, xmlPayload){
    this._controlPoints[filename] = xmlPayload;
  }

}

var index = { AdobeXmp, AdobeXmpCollection };

export default index;
//# sourceMappingURL=duskrcore.js.map
