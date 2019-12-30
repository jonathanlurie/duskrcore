import AdobeXmp from './AdobeXmp'

class AdobeXmpCollection {

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
      let sufix = filename.slice(numberPosition + number.toString().length )
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
    this._controlPoints = {}
  }


  addControlPoint(filename, xmlPayload){
    this._controlPoints[filename] = xmlPayload
  }

}

export default AdobeXmpCollection
