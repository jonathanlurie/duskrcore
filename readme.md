**Duskr Core** is the processing engine for Adobe XMP setting interpolation. XMP files are created by Adobe Camera Raw and Adobe Lightroom. They carry all the raw file development setting, such as `brightness`, `contrast`, `crop` and more than a hundred others.  

**What's with the interpolation?** Processing one photo on Camera Raw is quite easy, processing 100 is a pain, processing 1000 is a very annoying full time job. Interpolating is made for sequences, such a timelapses, where light conditions are going to change along the capture, especially at dawn or dusk (hence the name `duskrcore`).  

**What's the process?** So instead of processing each frame of a timelapse manually and making sure the sliders on each frame are well adjusted to the varying light condition (spoiler alert: this is an impossible task!), just some pictures of the sequence must be processed, most likely the first and the last. Then, *duskrcore* is going to interpolate and create XMP files for all the ones in the middle that were not processed.

**How does the interpolation work?** The method chosen for interpolation is a monotonic spline, which is a comparable method to what is used in the 'curve' tool from Photoshop. Some points are set, and the rest is smoothly interpolated. Same here. Cubic splines were also considered but it can get pretty bumpy when two control points close in time are having very big delta, it would create unnecessary artifacts. In the future, Catmull-Rom spline may replace the monotonic spline to allow tuning the 'stiffness' of the interpolation.


**Does it work on every settings available from Camera Raw?** Not yet. To make it simple, at the moment, only the settings that are using simple sliders are available. Here is the list of common features that are not yet available but still on the roadmap (from hight to low priority):
- [x] cropping
- [ ] curve (custom points)
- [ ] curve (parametric)
- [ ] graduated filter
- [ ] rotations
