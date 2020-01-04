import XmlParser from 'xml-js';
import { MonotonicCubicSpline } from 'splines';

// list of basic attributes to not interpolate
const UNSETTINGS = [
  'Version',
  'ProcessVersion'
];

class AdobeMetadata {

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

    if(typeof val === 'number'){
      // round to a precision that is unnecessary for most settings but that is
      // relevant for the crop
      let roundedVal = Math.round(val * 1000000) / 1000000;
      return roundedVal.toString()
    }

    return val.trim()
  }


  static validateCurveData(values){
    if(values.length < 2)
      throw new Error('Curve data must contain at least two points.')

    if(! values.every(point => Array.isArray(point) && (point.length === 2) ) )
      throw new Error('Each point provided to a curve must be arrays of size two.')

    values.flat().forEach(val => {
      if(isNaN(val))
        throw new Error('All the curve data values must be numbers')

      if(val < 0 || val > 255 )
        throw new Error('All values must be in the range [0, 255]')
    });

    return true
  }


  static orderCurveData(values){
    let orderedAlongX = values.sort((pointA, pointB) => pointA[0] - pointB[0] );
    return orderedAlongX
  }


  /**
   * Check is the curve has only the values [[0, 0], [255, 255]]
   */
  static isDefaultCurve(values){
    try{
      if(value.length === 2 &&
         value[0][0] === 0 && value[0][1] === 0 &&
         value[1][0] === 255 && value[1][1] === 255){
        return true
      }else{
        return false
      }
    }catch(e){
      return false
    }
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
    return this._getDescriptionObject()['_attributes']
  }


  _getDescriptionObject(){
    return this._objectRepresentation['x:xmpmeta']['rdf:RDF']['rdf:Description']
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


  getListOfSettingAttributes(){
    let ba = this._getBasicAttributesObject();
    let allNames = Object.keys(ba)
      .filter(attrName => attrName.startsWith('crs:'))
      .filter(attrName => {
        let attrValue = ba[attrName];
        return !isNaN(parseFloat(attrValue))
      })
      .map(attrName => attrName.split(':')[1])
      .filter(attrName => !UNSETTINGS.includes(attrName));

    return allNames
  }


  getSettingAttribute(attrName){
    let ba = this._getBasicAttributesObject();
    if(`crs:${attrName}` in ba){
      return AdobeMetadata.convertToRelevantType(ba[`crs:${attrName}`])
    }else{
      return null
    }
  }


  setSettingAttribute(attrName, value){
    let ba = this._getBasicAttributesObject();
    ba[`crs:${attrName}`] = AdobeMetadata.convertToString(value);
  }


  hasCrop(){
    let ba = this._getBasicAttributesObject();
    return this.getSettingAttribute('HasCrop')
  }


  enableCropping(){
    let ba = this._getBasicAttributesObject();
    if(!this.getSettingAttribute('HasCrop')){
      this.setSettingAttribute('HasCrop', true); // This one was false
      this.setSettingAttribute('CropTop', 0); // this one and the next where not existing
      this.setSettingAttribute('CropLeft', 0);
      this.setSettingAttribute('CropBottom', 1);
      this.setSettingAttribute('CropRight', 1);
      this.setSettingAttribute('CropAngle', 0);
      this.setSettingAttribute('CropConstrainToWarp', 1);
    }
  }


  // ToneCurvePV2012
  getCurveTone(color=''){
    let desc = this._getDescriptionObject();
    let curveObjName = 'crs:ToneCurvePV2012';

    if(color.toLowerCase() === 'red')
      curveObjName += 'Red';
    else if(color.toLowerCase() === 'green')
      curveObjName += 'Green';
    else if(color.toLowerCase() === 'blue')
      curveObjName += 'Blue';

    let curveObj = desc[curveObjName]['rdf:Seq']['rdf:li']; // this is an array
    let curveData = curveObj.map(li => {
      // for each li elem, there is a string with 2 numbers separated by a comma: "128, 128"
      let text = li._text;
      let values = text.split(',').map(numStr => parseInt(numStr.trim()));
      return values
    });

    return curveData
  }


  setCurveTone(values, color=''){
    AdobeMetadata.validateCurveData(values); // possibly throw an exception

    // perform a possibly unnecessary reordering or data
    let orderedValues = AdobeMetadata.orderCurveData(values);

    let desc = this._getDescriptionObject();
    let curveObjName = 'crs:ToneCurvePV2012';

    if(color.toLowerCase() === 'red')
      curveObjName += 'Red';
    else if(color.toLowerCase() === 'green')
      curveObjName += 'Green';
    else if(color.toLowerCase() === 'blue')
      curveObjName += 'Blue';

    // let curveObj = desc[curveObjName]['rdf:Seq']['rdf:li'] // this is an array
    desc[curveObjName]['rdf:Seq']['rdf:li'] = orderedValues.map(point => {
      return {
        _text: point.join(', ')
      }
    });
  }





  addCurvePoint(point, color=''){
    let curveData = this.getCurveTone(color);
    curveData.push(point);
    this.setCurveTone(curveData, color);
  }


  getCurveNumberOfPoints(color=''){
    return this.getCurveTone(color).length
  }


  /**
   * Add some duplicata curve points that will be interpolate afterwards.
   * The index of the duplicated point is random, to be tested if it's the correct approach.
   */
  addCurveFakePoints(numberOfPoints, color=''){
    let curveData = this.getCurveTone(color);
    let existingCurveData = this.getCurveTone(color);
    let originalLength = existingCurveData.length;

    let pointsToAdd = numberOfPoints;
    while(pointsToAdd){
      existingCurveData.push(existingCurveData[~~(Math.random() * originalLength)].slice());
      pointsToAdd --;
    }
    this.setCurveTone(existingCurveData, color);
  }


  /**
   * Remove duplicate of curve points that were added synthetically.
   * Are considered 'duplicates' two points that have the same x value
   * (y does not matter)
   */
  sanitizeCurve(color=''){
    let existingCurveData = this.getCurveTone(color);
    let existingX = [];
    let newCurveData = [];

    existingCurveData.forEach(point => {
      if(!existingX.includes(point[0])){
        existingX.push(point[0]);
        newCurveData.push(point);
      }
    });
    this.setCurveTone(newCurveData, color);
  }


  clone(){
    let clone = new AdobeMetadata();
    clone.setXmlPayload(this._xmlPayload);
    return clone
  }

}

class AdobeMetadataInterpolator {

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
      let suffix = filename.slice(numberPosition + number.toString().length );
      return {
        number: number,
        prefix: prefix,
        suffix: suffix
      }
    }else{
      return null
    }
  }

  constructor(){
    this._controlPoints = {};
    this._collection = {};
  }


  addControlPoint(filename, xmlPayload){
    let sequenceInfo = AdobeMetadataInterpolator.findNumberSequence(filename);
    if(!sequenceInfo){
      throw new Error(`The filename must contain a sequence of number in its name. ("${filename}" given)`)
    }

    let adobeMetadata = new AdobeMetadata();
    adobeMetadata.setXmlPayload(xmlPayload);

    this._controlPoints[sequenceInfo.number] = {
      filename: filename,
      adobeMetadata: adobeMetadata,
      ...sequenceInfo
    };

    console.log(adobeMetadata);

    // resetting the collection
    this._collection = {};
  }


  checkControlPointIntegrity(){
    let controlPointList = Object.values(this._controlPoints);

    // there must be at least two control point in order to interpolate in betwen
    if(controlPointList.length < 2){
      throw new Error(`There must be at least two control points, only ${controlPointList.length} given.`)
    }

    // they must all have the same prefix
    let allSamePrefix = controlPointList.map(cp => cp.prefix).every(prefix => prefix === controlPointList[0].prefix);
    if(!allSamePrefix){
      throw new Error('All the control point filename must have the same shape: prefix, sequence number, suffix. Prefixes differ.')
    }

    // they must all have the same suffix
    let allSameSuffix = controlPointList.map(cp => cp.suffix).every(suffix => suffix === controlPointList[0].suffix);
    if(!allSameSuffix){
      throw new Error('All the control point filename must have the same shape: prefix, sequence number, suffix. Suffixes differ.')
    }

    // check if all the provided meta are actually the result of development
    let allHaveSettings = controlPointList.map(cp => cp.adobeMetadata).every(adobeMetadata => adobeMetadata.hasSettings());
    if(!allHaveSettings){
      throw new Error('All the provided XMP file must be the result of photo development (not blank).')
    }

    return true
  }


  interpolate(){
    // order the control points
    let controlPointList = Object.values(this._controlPoints)
      .sort((a, b) => a.number < b.number ? -1 : 1);

    let firstControlPoint = controlPointList[0];
    let firstIndex = firstControlPoint.number;
    let lastIndex = controlPointList[controlPointList.length - 1].number;
    let prefix = firstControlPoint.prefix;
    let suffix = firstControlPoint.suffix;

    // check is any of these has the cropping enable, if so, enable for all
    // so that we can interpolate the crop just like any other params
    let someHasCrop = controlPointList.map(cp => cp.adobeMetadata).some(meta => meta.hasCrop());
    if(someHasCrop){
      controlPointList.map(cp => cp.adobeMetadata).forEach(meta => meta.enableCropping());
    }

    // create clones of the first AdobeMetadata objects for all the series
    let intermediates = [];
    for(let i=firstIndex; i<=lastIndex; i++){
      if(i in this._controlPoints){
        intermediates.push(this._controlPoints[i]); // replacing an intermediate by a control point
      }else{
        let clone = firstControlPoint.adobeMetadata.clone();
        clone.setRawFileName(`${prefix}${i}${suffix}`);
        intermediates.push({
          adobeMetadata: clone,
          number: i
        });
      }
    }

    // get the list of setting attributes
    let settingAttributeNames = firstControlPoint.adobeMetadata.getListOfSettingAttributes();

    // for each setting attribute, we build a spline that goes along all the control points
    let xs = controlPointList.map(cp => cp.number);

    // for each settings, we create the y coordinates to interpolate on
    settingAttributeNames.forEach(attr => {
      let ys = controlPointList.map(cp => cp.adobeMetadata.getSettingAttribute(attr));
      let splineInterpolator = new MonotonicCubicSpline(xs, ys);

      // for each intermediate, we interpolate
      intermediates.forEach(inter => {
        // control points don't need interpolation
        if(inter.number in this._controlPoints){
          return
        }

        inter.adobeMetadata.setSettingAttribute(attr, splineInterpolator.interpolate(inter.number));
      });
    });


    // curve interpolation
    




    // building the collection
    intermediates.forEach(inter => {
      this._collection[`${prefix}${inter.number}${suffix}`] = inter.adobeMetadata;
    });

    return this._collection
  }


  getCollection(){
    return this._collection
  }

}

var index = { AdobeMetadata, AdobeMetadataInterpolator };

export default index;
//# sourceMappingURL=duskrcore.js.map
