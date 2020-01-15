import AdobeMetadata from './AdobeMetadata'
import { MonotonicCubicSpline } from 'splines'


class AdobeMetadataInterpolator {

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
    let sequenceInfo = AdobeMetadataInterpolator.findNumberSequence(filename)
    if(!sequenceInfo){
      throw new Error(`The filename must contain a sequence of number in its name. ("${filename}" given)`)
    }

    let adobeMetadata = new AdobeMetadata()
    adobeMetadata.setXmlPayload(xmlPayload)

    this._controlPoints[sequenceInfo.number] = {
      filename: filename,
      adobeMetadata: adobeMetadata,
      ...sequenceInfo
    }

    console.log(adobeMetadata)

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

    // check if all the provided meta are actually the result of development
    let allHaveSettings = controlPointList.map(cp => cp.adobeMetadata).every(adobeMetadata => adobeMetadata.hasSettings())
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

    // check is any of these has the cropping enable, if so, enable for all
    // so that we can interpolate the crop just like any other params
    let someHasCrop = controlPointList.map(cp => cp.adobeMetadata).some(meta => meta.hasCrop())
    if(someHasCrop){
      controlPointList.map(cp => cp.adobeMetadata).forEach(meta => meta.enableCropping())
    }

    // create clones of the first AdobeMetadata objects for all the series
    let intermediates = []
    for(let i=firstIndex; i<=lastIndex; i++){
      if(i in this._controlPoints){
        intermediates.push(this._controlPoints[i]) // replacing an intermediate by a control point
      }else{
        let clone = firstControlPoint.adobeMetadata.clone()
        clone.setRawFileName(`${prefix}${i}${suffix}`)
        intermediates.push({
          adobeMetadata: clone,
          number: i
        })
      }
    }

    // get the list of setting attributes
    let settingAttributeNames = firstControlPoint.adobeMetadata.getListOfSettingAttributes()

    // for each setting attribute, we build a spline that goes along all the control points
    let xs = controlPointList.map(cp => cp.number)

    // for each settings, we create the y coordinates to interpolate on
    settingAttributeNames.forEach(attr => {
      let ys = controlPointList.map(cp => cp.adobeMetadata.getSettingAttribute(attr))
      let splineInterpolator = new MonotonicCubicSpline(xs, ys)

      // for each intermediate, we interpolate
      intermediates.forEach(inter => {
        // control points don't need interpolation
        if(inter.number in this._controlPoints){
          return
        }

        inter.adobeMetadata.setSettingAttribute(attr, splineInterpolator.interpolate(inter.number))
      })
    })


    // curve interpolation
    function interpolateCurve(color=''){
      // get the curve that has the largest amount of point among all the control points
      let maxNbPoint = 0
      controlPointList.forEach(cp => {
        let nbPoints = cp.adobeMetadata.getCurveNumberOfPoints()
        maxNbPoint = Math.max(maxNbPoint, nbPoints)
      })

      // add fake points to all the control point curve, so that all curves from
      // a given color have the same number of points n each control point
      controlPointList.forEach(cp => {
        let nbPoints = cp.adobeMetadata.getCurveNumberOfPoints()
        if(nbPoints < maxNbPoint){
          cp.adobeMetadata.addCurveInterpolationPoints(maxNbPoint - nbPoints, color)
        }
      })

      let curvePointsForIntermediates = new Array(maxNbPoint)

      // for each point of the curve, we interpolate
      for(let i=0; i<maxNbPoint; i++){
        curvePointsForIntermediates[i] = []
        let allTheiPoints = controlPointList.map(cp => cp.adobeMetadata.getCurveTone(color)[i])
        let xs = controlPointList.map(cp => cp.number)
        let curveXs = allTheiPoints.map(iPoint => iPoint[0])
        let curveYs = allTheiPoints.map(iPoint => iPoint[1])
        let splineInterpolatorCurveX = new MonotonicCubicSpline(xs, curveXs)
        let splineInterpolatorCurveX = new MonotonicCubicSpline(xs, curveYs)

        // to reshape so that curvePointsForIntermediates is p0p0p0p0... p1p1p1p1...
        // intermediates.forEach(inter => {
        //   // control points don't need interpolation
        //   if(inter.number in this._controlPoints){
        //     return
        //   }
        //
        //   inter.adobeMetadata.setSettingAttribute(attr, splineInterpolator.interpolate(inter.number))
        // })
      }


    }

    interpolateCurve()




    // building the collection
    intermediates.forEach(inter => {
      this._collection[`${prefix}${inter.number}${suffix}`] = inter.adobeMetadata
    })

    return this._collection
  }


  getCollection(){
    return this._collection
  }

}

export default AdobeMetadataInterpolator
