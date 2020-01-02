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
      // round to a precision that is unnecessary for most settings but that is
      // relevant for the crop
      let roundedVal = Math.round(val * 1000000) / 1000000
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
    return this._getDescriptionObject()['_attributes']
  }


  _getDescriptionObject(){
    return this._objectRepresentation['x:xmpmeta']['rdf:RDF']['rdf:Description']
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


  hasCrop(){
    let ba = this._getBasicAttributesObject()
    return this.getSettingAttribute('HasCrop')
  }


  enableCropping(){
    let ba = this._getBasicAttributesObject()
    if(!this.getSettingAttribute('HasCrop')){
      this.setSettingAttribute('HasCrop', true) // This one was false
      this.setSettingAttribute('CropTop', 0) // this one and the next where not existing
      this.setSettingAttribute('CropLeft', 0)
      this.setSettingAttribute('CropBottom', 1)
      this.setSettingAttribute('CropRight', 1)
      this.setSettingAttribute('CropAngle', 0)
      this.setSettingAttribute('CropConstrainToWarp', 1)
    }
  }


  // ToneCurvePV2012
  getCurveToneCurve(color=''){
    let desc = this._getDescriptionObject()
    let curveObjName = 'crs:ToneCurvePV2012'
    if(color === 'red')
      curveObjName += 'Red'
    if(color === 'green')
      curveObjName += 'Green'
    if(color === 'blue')
      curveObjName += 'Blue'

    let curveObj = desc[curveObjName]['rdf:Seq']['rdf:li'] // this is an array
    let curveData = curveObj.map(li => {
      // for each li elem, there is a string with 2 numbers separated by a comma: "128, 128"
      let text = li._text
      let values = text.split(',').map(numStr => parseInt(numStr.trim()))
      return values
    })

    return curveData
  }

  


  clone(){
    let clone = new AdobeXmp()
    clone.setXmlPayload(this._xmlPayload)
    return clone
  }

}

export default AdobeXmp
