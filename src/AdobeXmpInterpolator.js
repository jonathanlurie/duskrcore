import AdobeXmp from './AdobeXmp'
import { MonotonicCubicSpline } from 'splines'


class AdobeXmpInterpolator {

  static findNumberSequence(filename){
    let splitChar = ' '
    let numbersOnly = Array.from(filename).map(char => isNaN(parseInt(char)) ? splitChar : char)
      .join('')
      .split(splitChar)
      .filter(substr => substr !== '')
      .map(substr => parseInt(substr))
      .filter(substr => substr !== NaN)

    if(numbersOnly.length){
      let number = numbersOnly[0]
      let numberPosition = filename.indexOf(number)
      let prefix = filename.slice(0, numberPosition)
      let suffix = filename.slice(numberPosition + number.toString().length )
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
    this._controlPoints = {}
    this._collection = {}
  }


  addControlPoint(filename, xmlPayload){
    let sequenceInfo = AdobeXmpInterpolator.findNumberSequence(filename)
    if(!sequenceInfo){
      throw new Error(`The filename must contain a sequence of number in its name. ("${filename}" given)`)
    }

    let adobeXmp = new AdobeXmp()
    adobeXmp.setXmlPayload(xmlPayload)

    this._controlPoints[sequenceInfo.number] = {
      filename: filename,
      adobeXmp: adobeXmp,
      ...sequenceInfo
    }

    console.log(adobeXmp)

    // resetting the collection
    this._collection = {}
  }


  checkControlPointIntegrity(){
    let controlPointList = Object.values(this._controlPoints)

    // there must be at least two control point in order to interpolate in betwen
    if(controlPointList.length < 2){
      throw new Error(`There must be at least two control points, only ${controlPointList.length} given.`)
    }

    // they must all have the same prefix
    let allSamePrefix = controlPointList.map(cp => cp.prefix).every(prefix => prefix === controlPointList[0].prefix)
    if(!allSamePrefix){
      throw new Error('All the control point filename must have the same shape: prefix, sequence number, suffix. Prefixes differ.')
    }

    // they must all have the same suffix
    let allSameSuffix = controlPointList.map(cp => cp.suffix).every(suffix => suffix === controlPointList[0].suffix)
    if(!allSameSuffix){
      throw new Error('All the control point filename must have the same shape: prefix, sequence number, suffix. Suffixes differ.')
    }

    // check if all the provided xmp are actually the result of development
    let allHaveSettings = controlPointList.map(cp => cp.adobeXmp).every(adobeXmp => adobeXmp.hasSettings())
    if(!allHaveSettings){
      throw new Error('All the provided XMP file must be the result of photo development (not blank).')
    }

    return true
  }


  interpolate(){
    // order the control points
    let controlPointList = Object.values(this._controlPoints)
      .sort((a, b) => a.number < b.number ? -1 : 1)

    let firstControlPoint = controlPointList[0]
    let firstIndex = firstControlPoint.number
    let lastIndex = controlPointList[controlPointList.length - 1].number
    let prefix = firstControlPoint.prefix
    let suffix = firstControlPoint.suffix

    // create clones of the first AdobeXmp objects for all the series
    let intermediates = []
    for(let i=firstIndex; i<=lastIndex; i++){
      if(i in this._controlPoints){
        intermediates.push(this._controlPoints[i]) // replacing an intermediate by a control point
      }else{
        intermediates.push({
          adobeXmp: firstControlPoint.adobeXmp.clone(),
          number: i
        })
      }
    }

    // get the list of setting attributes
    let settingAttributeNames = firstControlPoint.adobeXmp.getListOfSettingAttributes()

    // for each setting attribute, we build a spline that goes along all the control points
    let xs = controlPointList.map(cp => cp.number)

    // for each settings, we create the y coordinates to interpolate on
    settingAttributeNames.forEach(attr => {
      let ys = controlPointList.map(cp => cp.adobeXmp.getSettingAttribute(attr))
      let splineInterpolator = new MonotonicCubicSpline(xs, ys)

      // for each intermediate, we interpolate
      intermediates.forEach(inter => {
        // control points don't need interpolation
        if(inter.number in this._controlPoints){
          return
        }

        inter.adobeXmp.setSettingAttribute(attr, splineInterpolator.interpolate(inter.number))
      })
    })


    // building the collection
    intermediates.forEach(inter => {
      this._collection[`${prefix}${inter.number}${suffix}`] = inter.adobeXmp
    })

    return this._collection
  }


  getCollection(){
    return this._collection
  }

}

export default AdobeXmpInterpolator
