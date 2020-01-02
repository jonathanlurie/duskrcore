import XmlParser from 'xml-js';

// list of basic attributes to not interpolate
const UNSETTINGS = [
  'Version',
  'ProcessVersion'
];

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

    if(typeof val === 'number'){
      // round to a precision that is unnecessary for most settings but that is
      // relevant for the crop
      let roundedVal = Math.round(val * 1000000) / 1000000;
      return roundedVal.toString()
    }

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
      return AdobeXmp.convertToRelevantType(ba[`crs:${attrName}`])
    }else{
      return null
    }
  }


  setSettingAttribute(attrName, value){
    let ba = this._getBasicAttributesObject();
    ba[`crs:${attrName}`] = AdobeXmp.convertToString(value);
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
  getCurveToneCurve(color=''){
    let desc = this._getDescriptionObject();
    let curveObjName = 'crs:ToneCurvePV2012';
    if(color === 'red')
      curveObjName += 'Red';
    if(color === 'green')
      curveObjName += 'Green';
    if(color === 'blue')
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

  


  clone(){
    let clone = new AdobeXmp();
    clone.setXmlPayload(this._xmlPayload);
    return clone
  }

}

/**
 * by George MacKerron, mackerron.com
 *
 * Monotonic Cubic Spline:
 *
 *  adapted from:
 *     http://sourceforge.net/mailarchive/forum.php?thread_name=EC90C5C6-C982-4F49-8D46-A64F270C5247%40gmail.com&forum_name=matplotlib-users
 *     (easier to read at http://old.nabble.com/%22Piecewise-Cubic-Hermite-Interpolating-Polynomial%22-in-python-td25204843.html)
 *
 *  with help from:
 *      F N Fritsch & R E Carlson (1980) 'Monotone Piecewise Cubic Interpolation', SIAM Journal of Numerical Analysis 17(2), 238 - 246.
 *      http://en.wikipedia.org/wiki/Monotone_cubic_interpolation
 *      http://en.wikipedia.org/wiki/Cubic_Hermite_spline
 *
 *
 *  Natural and Clamped:
 *
 *  adapted from:
 *      http://www.michonline.com/ryan/csc/m510/splinepresent.html
 **/

var CubicSpline, MonotonicCubicSpline;


MonotonicCubicSpline = function () {
    function MonotonicCubicSpline(x, y) {

        var alpha, beta, delta, dist, i, m, n, tau, to_fix, _i, _j, _len, _len2, _ref, _ref2, _ref3, _ref4;

        n = x.length;
        delta = [];
        m = [];
        alpha = [];
        beta = [];
        dist = [];
        tau = [];

        for (i = 0, _ref = n - 1; (0 <= _ref ? i < _ref : i > _ref); (0 <= _ref ? i += 1 : i -= 1)) {
            delta[i] = (y[i + 1] - y[i]) / (x[i + 1] - x[i]);
            if (i > 0) {
                m[i] = (delta[i - 1] + delta[i]) / 2;
            }
        }

        m[0] = delta[0];
        m[n - 1] = delta[n - 2];
        to_fix = [];

        for (i = 0, _ref2 = n - 1; (0 <= _ref2 ? i < _ref2 : i > _ref2); (0 <= _ref2 ? i += 1 : i -= 1)) {
            if (delta[i] === 0) {
                to_fix.push(i);
            }
        }

        for (_i = 0, _len = to_fix.length; _i < _len; _i++) {
            i = to_fix[_i];
            m[i] = m[i + 1] = 0;
        }

        for (i = 0, _ref3 = n - 1; (0 <= _ref3 ? i < _ref3 : i > _ref3); (0 <= _ref3 ? i += 1 : i -= 1)) {
            alpha[i] = m[i] / delta[i];
            beta[i] = m[i + 1] / delta[i];
            dist[i] = Math.pow(alpha[i], 2) + Math.pow(beta[i], 2);
            tau[i] = 3 / Math.sqrt(dist[i]);
        }


        to_fix = [];

        for (i = 0, _ref4 = n - 1; (0 <= _ref4 ? i < _ref4 : i > _ref4); (0 <= _ref4 ? i += 1 : i -= 1)) {
            if (dist[i] > 9) {
                to_fix.push(i);
            }
        }

        for (_j = 0, _len2 = to_fix.length; _j < _len2; _j++) {
            i = to_fix[_j];
            m[i] = tau[i] * alpha[i] * delta[i];
            m[i + 1] = tau[i] * beta[i] * delta[i];
        }

        this.x = x.slice(0, n);
        this.y = y.slice(0, n);
        this.m = m;
    }

    MonotonicCubicSpline.prototype.interpolate = function (x) {
        var h, h00, h01, h10, h11, i, t, t2, t3, y, _ref;

        for (i = _ref = this.x.length - 2; (_ref <= 0 ? i <= 0 : i >= 0); (_ref <= 0 ? i += 1 : i -= 1)) {
            if (this.x[i] <= x) {
                break;
            }
        }

        h = this.x[i + 1] - this.x[i];
        t = (x - this.x[i]) / h;
        t2 = Math.pow(t, 2);
        t3 = Math.pow(t, 3);
        h00 = 2 * t3 - 3 * t2 + 1;
        h10 = t3 - 2 * t2 + t;
        h01 = -2 * t3 + 3 * t2;
        h11 = t3 - t2;
        y = h00 * this.y[i] + h10 * h * this.m[i] + h01 * this.y[i + 1] + h11 * h * this.m[i + 1];

        return y;
    };

    return MonotonicCubicSpline;
}();


CubicSpline = function () {
    function CubicSpline(x, a, d0, dn) {

        var b, c, clamped, d, h, i, k, l, n, s, u, y, z, _ref;

        if (!((x != null) && (a != null))) {
            return;
        }

        clamped = (d0 != null) && (dn != null);
        n = x.length - 1;
        h = [];
        y = [];
        l = [];
        u = [];
        z = [];
        c = [];
        b = [];
        d = [];
        k = [];
        s = [];

        for (i = 0; (0 <= n ? i < n : i > n); (0 <= n ? i += 1 : i -= 1)) {
            h[i] = x[i + 1] - x[i];
            k[i] = a[i + 1] - a[i];
            s[i] = k[i] / h[i];
        }

        if (clamped) {
            y[0] = 3 * (a[1] - a[0]) / h[0] - 3 * d0;
            y[n] = 3 * dn - 3 * (a[n] - a[n - 1]) / h[n - 1];
        }

        for (i = 1; (1 <= n ? i < n : i > n); (1 <= n ? i += 1 : i -= 1)) {
            y[i] = 3 / h[i] * (a[i + 1] - a[i]) - 3 / h[i - 1] * (a[i] - a[i - 1]);
        }

        if (clamped) {
            l[0] = 2 * h[0];
            u[0] = 0.5;
            z[0] = y[0] / l[0];
        } else {
            l[0] = 1;
            u[0] = 0;
            z[0] = 0;
        }

        for (i = 1; (1 <= n ? i < n : i > n); (1 <= n ? i += 1 : i -= 1)) {
            l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * u[i - 1];
            u[i] = h[i] / l[i];
            z[i] = (y[i] - h[i - 1] * z[i - 1]) / l[i];
        }

        if (clamped) {
            l[n] = h[n - 1] * (2 - u[n - 1]);
            z[n] = (y[n] - h[n - 1] * z[n - 1]) / l[n];
            c[n] = z[n];
        } else {
            l[n] = 1;
            z[n] = 0;
            c[n] = 0;
        }

        for (i = _ref = n - 1; (_ref <= 0 ? i <= 0 : i >= 0); (_ref <= 0 ? i += 1 : i -= 1)) {
            c[i] = z[i] - u[i] * c[i + 1];
            b[i] = (a[i + 1] - a[i]) / h[i] - h[i] * (c[i + 1] + 2 * c[i]) / 3;
            d[i] = (c[i + 1] - c[i]) / (3 * h[i]);
        }

        this.x = x.slice(0, n + 1);
        this.a = a.slice(0, n);
        this.b = b;
        this.c = c.slice(0, n);
        this.d = d;
    }

    CubicSpline.prototype.derivative = function () {

        var c, d, s, x, _i, _j, _len, _len2, _ref, _ref2, _ref3;

        s = new this.constructor();
        s.x = this.x.slice(0, this.x.length);
        s.a = this.b.slice(0, this.b.length);
        _ref = this.c;

        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            c = _ref[_i];
            s.b = 2 * c;
        }
        _ref2 = this.d;

        for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
            d = _ref2[_j];
            s.c = 3 * d;
        }

        for (x = 0, _ref3 = this.d.length; (0 <= _ref3 ? x < _ref3 : x > _ref3); (0 <= _ref3 ? x += 1 : x -= 1)) {
            s.d = 0;
        }

        return s;
    };


    CubicSpline.prototype.interpolate = function (x) {

        var deltaX, i, y, _ref;

        for (i = _ref = this.x.length - 1; (_ref <= 0 ? i <= 0 : i >= 0); (_ref <= 0 ? i += 1 : i -= 1)) {
            if (this.x[i] <= x) {
                break;
            }
        }

        deltaX = x - this.x[i];
        y = this.a[i] + this.b[i] * deltaX + this.c[i] * Math.pow(deltaX, 2) + this.d[i] * Math.pow(deltaX, 3);

        return y;
    };

    return CubicSpline;
}();

var splines = {
    CubicSpline: CubicSpline,
    MonotonicCubicSpline: MonotonicCubicSpline
};
var splines_2 = splines.MonotonicCubicSpline;

class AdobeXmpInterpolator {

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
    let sequenceInfo = AdobeXmpInterpolator.findNumberSequence(filename);
    if(!sequenceInfo){
      throw new Error(`The filename must contain a sequence of number in its name. ("${filename}" given)`)
    }

    let adobeXmp = new AdobeXmp();
    adobeXmp.setXmlPayload(xmlPayload);

    this._controlPoints[sequenceInfo.number] = {
      filename: filename,
      adobeXmp: adobeXmp,
      ...sequenceInfo
    };

    console.log(adobeXmp);

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

    // check if all the provided xmp are actually the result of development
    let allHaveSettings = controlPointList.map(cp => cp.adobeXmp).every(adobeXmp => adobeXmp.hasSettings());
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
    let someHasCrop = controlPointList.map(cp => cp.adobeXmp).some(xmp => xmp.hasCrop());
    if(someHasCrop){
      controlPointList.map(cp => cp.adobeXmp).forEach(xmp => xmp.enableCropping());
    }

    // create clones of the first AdobeXmp objects for all the series
    let intermediates = [];
    for(let i=firstIndex; i<=lastIndex; i++){
      if(i in this._controlPoints){
        intermediates.push(this._controlPoints[i]); // replacing an intermediate by a control point
      }else{
        let clone = firstControlPoint.adobeXmp.clone();
        clone.setRawFileName(`${prefix}${i}${suffix}`);
        intermediates.push({
          adobeXmp: clone,
          number: i
        });
      }
    }

    // get the list of setting attributes
    let settingAttributeNames = firstControlPoint.adobeXmp.getListOfSettingAttributes();

    // for each setting attribute, we build a spline that goes along all the control points
    let xs = controlPointList.map(cp => cp.number);

    // for each settings, we create the y coordinates to interpolate on
    settingAttributeNames.forEach(attr => {
      let ys = controlPointList.map(cp => cp.adobeXmp.getSettingAttribute(attr));
      let splineInterpolator = new splines_2(xs, ys);

      // for each intermediate, we interpolate
      intermediates.forEach(inter => {
        // control points don't need interpolation
        if(inter.number in this._controlPoints){
          return
        }

        inter.adobeXmp.setSettingAttribute(attr, splineInterpolator.interpolate(inter.number));
      });
    });


    // building the collection
    intermediates.forEach(inter => {
      this._collection[`${prefix}${inter.number}${suffix}`] = inter.adobeXmp;
    });

    return this._collection
  }


  getCollection(){
    return this._collection
  }

}

var index = { AdobeXmp, AdobeXmpInterpolator };

export default index;
//# sourceMappingURL=duskrcore.js.map