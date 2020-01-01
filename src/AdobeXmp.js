import XmlParser from 'xml-js'

// list of basic attributes to not interpolate
const UNSETTINGS = [
  'Version',
  'ProcessVersion'
]

class AdobeXmp {

  /**
   * Val is a string, but it can represent a number, a boolean or a string.
   * This function converts val into the most appropriate type.
   * @param  {string} val - a value
   * @return {string|number|boolean}
   */
  static convertToRelevantType(val){
    let cleanVal = val.trim()
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

    if(typeof val === 'number'){
      // we want 99.999 to become 100 but we want 99.99 to remain 99.99
      let roundedVal = Math.round(val * 100) / 100
      return roundedVal.toString()
    }

    return val.trim()
  }



  constructor(){
    this._xmlPayload = null
    this._objectRepresentation = null
  }


  setXmlPayload(xmlStr){
    this._xmlPayload = xmlStr
    let jsonPayload = XmlParser.xml2json(xmlStr, {compact: true})
    this._objectRepresentation = JSON.parse(jsonPayload)
  }


  getXml(){
    return XmlParser.json2xml(JSON.stringify(this._objectRepresentation), {compact: true, ignoreComment: true, spaces: 4})
  }


  _getBasicAttributesObject(){
    return this._objectRepresentation['x:xmpmeta']['rdf:RDF']['rdf:Description']['_attributes']
  }


  hasSettings(){
    let ba = this._getBasicAttributesObject()
    return ba['crs:HasSettings'] === 'True'
  }


  getRawFileName(){
    let ba = this._getBasicAttributesObject()
    return ba['crs:RawFileName']
  }


  setRawFileName(name){
    let ba = this._getBasicAttributesObject()
    ba['crs:RawFileName'] = name
  }


  getListOfSettingAttributes(){
    let ba = this._getBasicAttributesObject()
    let allNames = Object.keys(ba)
      .filter(attrName => attrName.startsWith('crs:'))
      .filter(attrName => {
        let attrValue = ba[attrName]
        return !isNaN(parseFloat(attrValue))
      })
      .map(attrName => attrName.split(':')[1])
      .filter(attrName => !UNSETTINGS.includes(attrName))

    return allNames
  }


  getSettingAttribute(attrName){
    let ba = this._getBasicAttributesObject()
    if(`crs:${attrName}` in ba){
      return AdobeXmp.convertToRelevantType(ba[`crs:${attrName}`])
    }else{
      return null
    }
  }


  setSettingAttribute(attrName, value){
    let ba = this._getBasicAttributesObject()
    ba[`crs:${attrName}`] = AdobeXmp.convertToString(value)
  }


  clone(){
    let clone = new AdobeXmp()
    clone.setXmlPayload(this._xmlPayload)
    return clone
  }

}

export default AdobeXmp
