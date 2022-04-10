// @flow

const React = require('react'), { Component } = React

const {
	Animated,
	Image,
	PanResponder,
	StyleSheet,
	TouchableWithoutFeedback,
	View,
} = require('react-native')

const Elevations = require('react-native-elevation')
const srcWheel = require('./assets/graphics/ui/color-wheel.png')
const srcWhitesWheel = require('./assets/graphics/ui/whites-wheel.png')

const RGB_MAX = 255
const HUE_MAX = 360
const SV_MAX = 100

const normalize = (degrees) => ((degrees % 360 + 360) % 360)

const rgb2Hsv = (r, g, b) => {
	if (typeof r === 'object') {
		const args = r
		r = args.r; g = args.g; b = args.b;
	}

	// It converts [0,255] format, to [0,1]
	r = (r === RGB_MAX) ? 1 : (r % RGB_MAX / parseFloat(RGB_MAX))
	g = (g === RGB_MAX) ? 1 : (g % RGB_MAX / parseFloat(RGB_MAX))
	b = (b === RGB_MAX) ? 1 : (b % RGB_MAX / parseFloat(RGB_MAX))

	let max = Math.max(r, g, b)
	let min = Math.min(r, g, b)
	let h, s, v = max

	let d = max - min

	s = max === 0 ? 0 : d / max

	if (max === min) {
		h = 0 // achromatic
	} else {
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0)
				break
			case g:
				h = (b - r) / d + 2
				break
			case b:
				h = (r - g) / d + 4
				break
		}
		h /= 6
	}

	return {
		h: Math.round(h * HUE_MAX),
		s: Math.round(s * SV_MAX),
		v: Math.round(v * SV_MAX)
	}
}

const hsv2Rgb = (h, s, v) => {
	if (typeof h === 'object') {
		const args = h
		h = args.h; s = args.s; v = args.v;
	}

	h = normalize(h)
	h = (h === HUE_MAX) ? 1 : (h % HUE_MAX / parseFloat(HUE_MAX) * 6)
	s = (s === SV_MAX) ? 1 : (s % SV_MAX / parseFloat(SV_MAX))
	v = (v === SV_MAX) ? 1 : (v % SV_MAX / parseFloat(SV_MAX))

	let i = Math.floor(h)
	let f = h - i
	let p = v * (1 - s)
	let q = v * (1 - f * s)
	let t = v * (1 - (1 - f) * s)
	let mod = i % 6
	let r = [v, q, p, p, t, v][mod]
	let g = [t, v, v, q, p, p][mod]
	let b = [p, p, t, v, v, q][mod]

	return {
		r: Math.floor(r * RGB_MAX),
		g: Math.floor(g * RGB_MAX),
		b: Math.floor(b * RGB_MAX),
	}
}

const rgb2Hex = (r, g, b) => {
	if (typeof r === 'object') {
		const args = r
		r = args.r; g = args.g; b = args.b;
	}
	r = Math.round(r).toString(16)
	g = Math.round(g).toString(16)
	b = Math.round(b).toString(16)

	r = r.length === 1 ? '0' + r : r
	g = g.length === 1 ? '0' + g : g
	b = b.length === 1 ? '0' + b : b

	return '#' + r + g + b
}

const hex2Rgb = (hex) => {
	let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
	return result ? {
		r: parseInt(result[1], 16),
		g: parseInt(result[2], 16),
		b: parseInt(result[3], 16)
	} : null
}

const hsv2Hex = (h, s, v) => {
	let rgb = hsv2Rgb(h, s, v)
	return rgb2Hex(rgb.r, rgb.g, rgb.b)
}

const hex2Hsv = (hex) => {
	let rgb = hex2Rgb(hex)
	return rgb2Hsv(rgb.r, rgb.g, rgb.b)
}

const kelvinToRgb = (kelvin) => {
	var temp = kelvin / 100;
	var r, g, b;

	if (temp < 66) {
		r = 255;
		g = -155.25485562709179 - 0.44596950469579133 * (g = temp - 2) + 104.49216199393888 * Math.log(g);
		b = temp < 20 ? 0 : -254.76935184120902 + 0.8274096064007395 * (b = temp - 10) + 115.67994401066147 * Math.log(b);
	} else {
		r = 351.97690566805693 + 0.114206453784165 * (r = temp - 55) - 40.25366309332127 * Math.log(r);
		g = 325.4494125711974 + 0.07943456536662342 * (g = temp - 50) - 28.0852963507957 * Math.log(g);
		b = 255;
	}

	return {
		r: clamp(Math.floor(r), 0, 255),
		g: clamp(Math.floor(g), 0, 255),
		b: clamp(Math.floor(b), 0, 255)
	};
}

const rgbToKelvin = (rgb, minTemp, maxTemp) => {
	var r = rgb.r,
		b = rgb.b;
	var eps = 0.4;
	var temp;

	while (maxTemp - minTemp > eps) {
		temp = (maxTemp + minTemp) * 0.5;

		var _rgb = kelvinToRgb(temp);

		if (_rgb.b / _rgb.r >= b / r) {
			maxTemp = temp;
		} else {
			minTemp = temp;
		}
	}

	return temp;
};

const clamp = (num, min, max) => {
	return Math.min(Math.max(num, min), max);
}

// expands hex to full 6 chars (#fff -> #ffffff) if necessary
const expandColor = color => typeof color == 'string' && color.length === 4
	? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
	: color;


module.exports = class ColorPicker extends Component {
	// testData = {}
	// testView = {forceUpdate(){}}
	color = {h:0,s:0,v:100}
	slideX = new Animated.Value(0)
	slideY = new Animated.Value(0)
	panX = new Animated.Value(30)
	panY = new Animated.Value(30)
	sliderLength = 0
	wheelSize = 0
	sliderMeasure = {}
	wheelMeasure = {}
	wheelWidth = 0
	static defaultProps = {
		whitesMode: false,
		row: false, // use row or vertical layout
		noSnap: false, // enables snapping on the center of wheel and edges of wheel and slider
		thumbSize: 50, // wheel color thumb size
		sliderSize: 20, // slider and slider color thumb size
		gapSize: 16, // size of gap between slider and wheel
		discrete: false, // use swatchs of shades instead of slider
		discreteLength: 10, // number of swatchs of shades
		sliderHidden: false, // if true the slider is hidden
		swatches: true, // show color swatches
		swatchesLast: true, // if false swatches are shown before wheel
		swatchesOnly: false, // show swatch only and hide wheel and slider
		swatchesHitSlop: undefined, // defines how far the touch event can start away from the swatch
		color: {h: 0, s: 0, v: 100}, //  color of the color picker
		palette: [], // palette colors of swatches
		minTemperature: 0,
		maxTemperature: 0,
		shadeWheelThumb: true, // if true the wheel thumb color is shaded
		shadeSliderThumb: false, // if true the slider thumb color is shaded
		autoResetSlider: false, // if true the slider thumb is reset to 0 value when wheel thumb is moved
		onInteractionStart: () => {}, // callback function triggered when user begins dragging slider/wheel
		onColorChange: () => {}, // callback function providing current color while user is actively dragging slider/wheel
		onColorChangeComplete: () => {}, // callback function providing final color when user stops dragging slider/wheel
	}
	wheelPanResponder = PanResponder.create({
		onStartShouldSetPanResponderCapture: (event, gestureState) => {
			const {nativeEvent} = event
			if (this.outOfWheel(nativeEvent)) return
			this.wheelMovement(event, gestureState)
			this.updateHueSaturation({nativeEvent})
			return true
		},
		onStartShouldSetPanResponder: () => true,
		onMoveShouldSetPanResponderCapture: () => true,
		onPanResponderGrant: (event, gestureState) => {
			const { locationX, locationY } = event.nativeEvent
			const { moveX, moveY, x0, y0 } = gestureState
			const x = x0 - locationX, y = y0 - locationY
			this.wheelMeasure.x = x
			this.wheelMeasure.y = y
			this.props.onInteractionStart();
			return true
		},
		onPanResponderMove: (event, gestureState) => {
			if(event && event.nativeEvent && typeof event.nativeEvent.preventDefault == 'function') event.nativeEvent.preventDefault()
			if(event && event.nativeEvent && typeof event.nativeEvent.stopPropagation == 'function') event.nativeEvent.stopPropagation()
			if (this.outOfWheel(event.nativeEvent) || this.outOfBox(this.wheelMeasure, gestureState)) return;
			this.wheelMovement(event, gestureState)
		},
		onMoveShouldSetPanResponder: () => true,
		onPanResponderRelease: (event, gestureState) => {
			const {nativeEvent} = event
			const {radius} = this.polar(nativeEvent)
			const {hsv} = this.state
			const {h,s,v} = hsv
			const {left, top} = this.cartesian(h, s / 100)
			if (!this.props.noSnap && radius <= 0.10 && radius >= 0) this.animate('#ffffff', 'hs', false, true)
			if (!this.props.noSnap && radius >= 0.95 && radius <= 1) this.animate(this.state.currentColor, 'hs', true)
			if (this.props.onColorChangeComplete) this.props.onColorChangeComplete(this.prepareFinalHsvColor(hsv, top))
			this.setState({currentColor:this.state.currentColor}, x=>this.renderDiscs())
		},
	})
	sliderPanResponder = PanResponder.create({
		onStartShouldSetPanResponderCapture: (event, gestureState) => {
			const {nativeEvent} = event
			if (this.outOfSlider(nativeEvent)) return
			this.sliderMovement(event, gestureState)
			this.updateValue({nativeEvent})
			return true
		},
		onStartShouldSetPanResponder: () => true,
		onMoveShouldSetPanResponderCapture: () => true,
		onPanResponderGrant: (event, gestureState) => {
			const { locationX, locationY } = event.nativeEvent
			const { moveX, moveY, x0, y0 } = gestureState
			const x = x0 - locationX, y = y0 - locationY
			this.sliderMeasure.x = x
			this.sliderMeasure.y = y
			this.props.onInteractionStart();
			return true
		},
		onPanResponderMove: (event, gestureState) => {
			if(event && event.nativeEvent && typeof event.nativeEvent.preventDefault == 'function') event.nativeEvent.preventDefault()
			if(event && event.nativeEvent && typeof event.nativeEvent.stopPropagation == 'function') event.nativeEvent.stopPropagation()
			if (this.outOfSlider(event.nativeEvent) || this.outOfBox(this.sliderMeasure, gestureState)) return;
			this.sliderMovement(event, gestureState)
		},
		onMoveShouldSetPanResponder: () => true,
		onPanResponderRelease: (event, gestureState) => {
			const {nativeEvent} = event
			const {hsv} = this.state
			const {h,s,v} = hsv
			const ratio = this.ratio(nativeEvent)
			const {left, top} = this.cartesian(h, s / 100)
			if (!this.props.noSnap && ratio <= 0.05 && ratio >= 0) this.animate(this.state.currentColor, 'v', false)
			if (!this.props.noSnap && ratio >= 0.95 && ratio <= 1) this.animate(this.state.currentColor, 'v', true)
			if (this.props.onColorChangeComplete) this.props.onColorChangeComplete(this.prepareFinalHsvColor(hsv, top))
		},
	})
	constructor (props) {
		super(props)
		this.mounted = false
		this.state = {
			wheelOpacity: 0,
			sliderOpacity: 0,
			hueSaturation: hsv2Hex(this.color.h,this.color.s,100),
			currentColor: this.parseIncomingColor(props.color),
			hsv: {h:0,s:0,v:100},
		}
		this.wheelMovement = new Animated.event(
			[
				{
					nativeEvent: {
						locationX: this.panX,
						locationY: this.panY,
					}
				},
				null,
			],
			{
				useNativeDriver: false,
				listener: this.updateHueSaturation
			}
		)
		this.sliderMovement = new Animated.event(
			[
				{
					nativeEvent: {
						locationX: this.slideX,
						locationY: this.slideY,
					}
				},
				null,
			],
			{
				useNativeDriver: false,
				listener: this.updateValue
			}
		)
		this.swatchAnim = props.palette.map((c,i) => (new Animated.Value(0)))
		this.discAnim = (`1`).repeat(props.discreteLength).split('').map((c,i) => (new Animated.Value(0)))
		this.renderSwatches()
		this.renderDiscs()
	}
	componentDidMount() {
		this.mounted = true;
	}
	componentWillUnmount() {
		this.mounted = false;
	}
	onSwatchPress = (c,i) => {
		if(!c) return;
		this.swatchAnim[i].stopAnimation()
		Animated.timing(this.swatchAnim[i], {
			toValue: 1,
			useNativeDriver: false,
			duration: 500,
		}).start(x=>{
			this.swatchAnim[i].setValue(0)
		})
		this.animate(c)
	}
	onDiscPress = (c,i) => {
		this.discAnim[i].stopAnimation()
		Animated.timing(this.discAnim[i], {
			toValue: 1,
			useNativeDriver: false,
			duration: 500,
		}).start(x=>{
			this.discAnim[i].setValue(0)
		})
		const val = i>=9?100:11*i
		this.updateValue({nativeEvent:null}, val)
		this.animate({h:this.color.h,s:this.color.s,v:val}, 'v')
	}
	onSquareLayout = (e) => {
		let {x, y, width } = e.nativeEvent.layout
		this.wheelWidth = width
		this.tryForceUpdate()
	}
	onWheelLayout = (e) => {
		/*
		* const {x, y, width, height} = nativeEvent.layout
		* onlayout values are different than measureInWindow
		* x and y are the distances to its previous element
		* but in measureInWindow they are relative to the window
		*/
		this.wheel.measureInWindow((x, y, width, height) => {
			this.wheelMeasure = {x, y, width, height}
			this.wheelSize = width
			// this.panX.setOffset(-width/2)
			// this.panY.setOffset(-width/2)
			if(!this.state.currentColor) {
				this.panX = new Animated.Value(width/2)
				this.panY = new Animated.Value(width/2)
			} else {
				this.update(this.state.currentColor)
			}
			this.setState({wheelOpacity:1})
		})
	}
	onSliderLayout = (e) => {
		this.slider.measureInWindow((x, y, width, height) => {
			this.sliderMeasure = {x, y, width, height}
			this.sliderLength = this.props.row ? height-width : width-height
			// this.slideX.setOffset(-width/2)
			// this.slideY.setOffset(-width/2)
			this.update(this.state.currentColor)
			this.setState({sliderOpacity:1})
		})
	}
	outOfBox (measure, gestureState) {
		const { x, y, width, height } = measure
		const { moveX, moveY, x0, y0 } = gestureState
		// console.log(`${moveX} , ${moveY} / ${x} , ${y} / ${locationX} , ${locationY}`);
		return !(moveX >= x && moveX <= x+width && moveY >= y && moveY <= y+height)
	}
	outOfWheel (nativeEvent) {
		const {radius} = this.polar(nativeEvent)
		return radius > 1
	}
	outOfSlider (nativeEvent) {
		const row = this.props.row
		const loc = row ? nativeEvent.locationY : nativeEvent.locationX
		const {width,height} = this.sliderMeasure
		return (loc > (row ? height-width : width-height))
	}
	val (v) {
		const d = this.props.discrete, r = 11*Math.round(v/11)
		return d ? (r>=99?100:r) : v
	}
	ratio (nativeEvent) {
		const row = this.props.row
		const loc = row ? nativeEvent.locationY : nativeEvent.locationX
		const {width,height} = this.sliderMeasure
		return loc / (row ? height-width : width-height)
	}
	polar (nativeEvent) {
		const lx = nativeEvent.locationX, ly = nativeEvent.locationY
		const [x, y] = [lx - this.wheelSize/2, ly - this.wheelSize/2]
		return {
			deg: Math.atan2(y, x) * (-180 / Math.PI),
			radius: Math.sqrt(y * y + x * x) / (this.wheelSize / 2),
		}
	}
	cartesian (deg, radius) {
		const r = radius * this.wheelSize / 2 // was normalized
		const rad = Math.PI * deg / 180
		const x = r * Math.cos(rad)
		const y = r * Math.sin(rad)
		return {
			left: this.wheelSize / 2 + x,
			top: this.wheelSize / 2 - y,
		}
	}
	parseIncomingColor (hsv) {
		if(this.props.whitesMode) {
			const kelvins = rgbToKelvin(hsv2Rgb(hsv.h, hsv.s, hsv.v), this.props.minTemperature, this.props.maxTemperature)
			const tempRange = this.props.maxTemperature - this.props.minTemperature;

			if(kelvins >= (this.props.minTemperature + tempRange/2)) {
				const percentage = ((kelvins - this.props.minTemperature - tempRange/2) / (tempRange/2)) * 100
				return {h: 90, s: percentage, v: hsv.v};
			} else {
				const percentage = 100 - ((kelvins - this.props.minTemperature) / (tempRange/2)) * 100
				return {h: -90, s: percentage, v: hsv.v};
			}
		} else {
			return hsv
		}
	}
	prepareFinalHsvColor (hsv, top) {
		if(this.props.whitesMode) {
			const tempRange = this.props.maxTemperature - this.props.minTemperature;
			let rgb = {
				r: 0,
				g: 0,
				b: 0
			}
			rgb = kelvinToRgb(this.props.minTemperature + (this.wheelSize - top) * (tempRange / this.wheelSize));
			const currHsv = {...rgb2Hsv(rgb.r, rgb.g, rgb.b), v: Math.round(hsv.v)};
			return {hsv: currHsv, hex: hsv2Hex(currHsv.h, currHsv.s, currHsv.v)};
		} else {
			const hex = hsv2Hex(hsv.h, hsv.s, hsv.v)
			return {hsv: hex2Hsv(hex), hex};
		}
	}

	updateHueSaturation = ({nativeEvent}) => {
		const {deg, radius} = this.polar(nativeEvent), h = deg, s = 100 * radius, v = this.color.v
		// if(radius > 1 ) return
		const hsv = {h,s,v}// v: 100} // causes bug
		if(this.props.autoResetSlider === true) {
			this.slideX.setValue(this.sliderLength)
			this.slideY.setValue(this.sliderLength)
			hsv.v = 100
		}
		const currentColor = hsv2Hex(hsv)
		this.color = hsv
		this.setState({hsv, currentColor, hueSaturation: hsv2Hex(this.color.h,this.color.s,100)})
		this.props.onColorChange(hsv2Hex(hsv))
	}
	updateValue = ({nativeEvent}, val) => {
		const {h,s} = this.color, v = (typeof val == 'number') ? val : 100 * this.ratio(nativeEvent)
		const hsv = {h,s,v}
		const currentColor = hsv2Hex(hsv)
		this.color = hsv
		this.setState({hsv, currentColor, hueSaturation: hsv2Hex(this.color.h,this.color.s,100)})
		this.props.onColorChange(hsv2Hex(hsv))
	}
	update = (color, who, max, force) => {
		color = expandColor(color);
		const specific = (typeof who == 'string'), who_hs = (who=='hs'), who_v = (who=='v')
		let {h, s, v} = (typeof color == 'string') ? hex2Hsv(color) : color, stt = {}
		h = (who_hs||!specific) ? h : this.color.h
		s = (who_hs && max) ? 100 : (who_hs && max===false) ? 0 : (who_hs||!specific) ? s : this.color.s
		v = (who_v && max) ? 100 : (who_v && max===false) ? 0 : (who_v||!specific) ? v : this.color.v
		const range = v / 100 * this.sliderLength
		const {left, top} = this.cartesian(h, s / 100)
		const hsv = {h,s,v}
		if(!specific||force) {
			this.color = hsv
			stt.hueSaturation = hsv2Hex(this.color.h,this.color.s,100)
			// this.setState({hueSaturation: hsv2Hex(this.color.h,this.color.s,100)})
		}
		stt.currentColor = hsv2Hex(hsv)
		this.setState(stt, x=>{ this.tryForceUpdate(); this.renderDiscs(); })
		// this.setState({currentColor:hsv2Hex(hsv)}, x=>this.tryForceUpdate())
		this.props.onColorChange(hsv2Hex(hsv))
		if (this.props.onColorChangeComplete) this.props.onColorChangeComplete(this.prepareFinalHsvColor(hsv, top))
		if(who_hs||!specific) {
			this.panY.setValue(top)// - this.props.thumbSize / 2)
			this.panX.setValue(left)// - this.props.thumbSize / 2)
		}
		if(who_v||!specific) {
			this.slideX.setValue(range)
			this.slideY.setValue(range)
		}
	}
	animate = (color, who, max, force) => {
		color = expandColor(color);
		const specific = (typeof who == 'string'), who_hs = (who=='hs'), who_v = (who=='v')
		let {h, s, v} = (typeof color == 'string') ? hex2Hsv(color) : color, stt = {}
		h = (who_hs||!specific) ? h : this.color.h
		s = (who_hs && max) ? 100 : (who_hs && max===false) ? 0 : (who_hs||!specific) ? s : this.color.s
		v = (who_v && max) ? 100 : (who_v && max===false) ? 0 : (who_v||!specific) ? v : this.color.v
		const range = v / 100 * this.sliderLength
		const {left, top} = this.cartesian(h, s / 100)
		const hsv = {h,s,v}
		// console.log(hsv);
		if(!specific||force) {
			this.color = hsv
			stt.hueSaturation = hsv2Hex(this.color.h,this.color.s,100)
			// this.setState({hueSaturation: hsv2Hex(this.color.h,this.color.s,100)})
		}
		stt.currentColor = hsv2Hex(hsv)
		this.setState(stt, x=>{ this.tryForceUpdate(); this.renderDiscs(); })
		// this.setState({currentColor:hsv2Hex(hsv)}, x=>this.tryForceUpdate())
		this.props.onColorChange(hsv2Hex(hsv))
		if (this.props.onColorChangeComplete) this.props.onColorChangeComplete(this.prepareFinalHsvColor(hsv, top))
		let anims = []
		if(who_hs||!specific) anims.push(//{//
			Animated.spring(this.panX, { toValue: left, useNativeDriver: false, friction: 90 }),//.start()//
			Animated.spring(this.panY, { toValue: top, useNativeDriver: false, friction: 90 }),//.start()//
		)//}//
		if(who_v||!specific) anims.push(//{//
			Animated.spring(this.slideX, { toValue: range, useNativeDriver: false, friction: 90 }),//.start()//
			Animated.spring(this.slideY, { toValue: range, useNativeDriver: false, friction: 90 }),//.start()//
		)//}//
		Animated.parallel(anims).start()
	}
	// componentWillReceiveProps(nextProps) {
	// 	const { color } = nextProps
	// 	if(color !== this.props.color) this.animate(color)
	// }
	componentDidUpdate(prevProps) {
		const { color, whitesMode } = this.props
		if((typeof color == 'string') && color !== prevProps.color) this.animate(color)
		if((typeof color != 'string') && (color.h !== prevProps.color.h || color.s !== prevProps.color.s || color.v !== prevProps.color.v)) this.animate(this.parseIncomingColor(color))
		if(whitesMode !== prevProps.whitesMode) this.animate(this.parseIncomingColor(color))
	}
	revert() {
		if(this.mounted) this.animate(this.props.color)
	}
	tryForceUpdate () {
		if(this.mounted) this.forceUpdate()
	}
	renderSwatches () {
		this.swatches = this.props.palette.map((c,i) => (
			<View style={[ss.swatchContainer]} key={'SC'+i}>
				<View style={[ss.swatch,{backgroundColor:c || '#ffffff', borderColor: '#838388', borderWidth: c ? 1 : 0}]} key={'S'+i} hitSlop={this.props.swatchesHitSlop}>
					<TouchableWithoutFeedback onPress={x=>this.onSwatchPress(c,i)} onLongPress={x=>this.props.onSwatchLongPress(c,i)} hitSlop={this.props.swatchesHitSlop}>
						<Animated.View style={[ss.swatchTouch,{backgroundColor:c,transform:[{scale:this.swatchAnim[i].interpolate({inputRange:[0,0.5,1],outputRange:[0.666,1,0.666]})}]}]} />
					</TouchableWithoutFeedback>
				</View>
			</View>
		))
	}
	renderDiscs () {
		this.disc = (`1`).repeat(this.props.discreteLength).split('').map((c,i) => (
			<View style={[ss.swatch,{backgroundColor:this.state.hueSaturation}]} key={'D'+i} hitSlop={this.props.swatchesHitSlop}>
				<TouchableWithoutFeedback onPress={x=>this.onDiscPress(c,i)} hitSlop={this.props.swatchesHitSlop}>
					<Animated.View style={[ss.swatchTouch,{backgroundColor:this.state.hueSaturation,transform:[{scale:this.discAnim[i].interpolate({inputRange:[0,0.5,1],outputRange:[0.666,1,0.666]})}]}]}>
						<View style={[ss.wheelImg,{backgroundColor:'#000',opacity:1-(i>=9?1:(i*11/100))}]}></View>
					</Animated.View>
				</TouchableWithoutFeedback>
			</View>
		)).reverse()
		this.tryForceUpdate()
	}
	render () {
		const {
			style,
			thumbSize,
			sliderSize,
			gapSize,
			swatchesLast,
			swatchesOnly,
			sliderHidden,
			discrete,
			row,
		} = this.props
		const swatches = !!(this.props.swatches || swatchesOnly)
		const hsv = hsv2Hex(this.color), hex = hsv2Hex(this.color.h,this.color.s,100)
		const wheelPanHandlers = this.wheelPanResponder && this.wheelPanResponder.panHandlers || {}
		const sliderPanHandlers = this.sliderPanResponder && this.sliderPanResponder.panHandlers || {}
		const opacity = this.state.wheelOpacity// * this.state.sliderOpacity
		const margin = swatchesOnly ? 0 : gapSize
		const wheelThumbStyle = {
			width: thumbSize,
			height: thumbSize,
			borderRadius: thumbSize / 2,
			// backgroundColor: this.props.shadeWheelThumb === true ? hsv: hex,
			transform: [{translateX:-thumbSize/2},{translateY:-thumbSize/2}],
			left: this.props.whitesMode ? new Animated.Value(this.wheelSize/2) : this.panX,
			top: this.panY,
			opacity,
			////
			// transform: [{translateX:this.panX},{translateY:this.panY}],
			// left: -this.props.thumbSize/2,
			// top: -this.props.thumbSize/2,
			// zIndex: 2,
		}
		const sliderThumbStyle = {
			left: row?0:this.slideX,
			top: row?this.slideY:0,
			// transform: [row?{translateX:8}:{translateY:8}],
			borderRadius: sliderSize/2,
			height: sliderSize,
			width: sliderSize,
			opacity,
		}
		const sliderStyle = {
			width:row?sliderSize:'100%',
			height:row?'100%':sliderSize,
			marginLeft:row?gapSize:0,
			marginTop:row?0:gapSize,
			// borderRadius:sliderSize/2,
		}
		const swatchStyle = {
			flexDirection:row?'column':'row',
			width:row?20:'100%',
			height:row?'100%':86,
			marginLeft:row?margin:0,
			marginTop:row?0:margin,
		}
		const swatchFirstStyle = {
			marginTop:0,
			marginLeft:0,
			marginRight:row?margin:0,
			marginBottom:row?0:margin,
		}
		// console.log('RENDER >>',row,thumbSize,sliderSize)
		return (
			<View style={[ss.root,row?{flexDirection:'row'}:{},style]}>
				{ swatches && !swatchesLast && <View style={[ss.swatches,swatchStyle,swatchFirstStyle]} key={'SW'}>{ this.swatches }</View> }
				{ !swatchesOnly && <View style={[ss.wheel]} key={'$1'} onLayout={this.onSquareLayout}>
					{ this.wheelWidth>0 && <View style={[{padding:thumbSize/2,width:this.wheelWidth,height:this.wheelWidth}]}>
						<View style={[ss.wheelWrap]}>
							<Image style={ss.wheelImg} source={this.props.whitesMode ? srcWhitesWheel : srcWheel} />
							<Animated.View style={[ss.wheelThumb,wheelThumbStyle,Elevations[4],{pointerEvents:'none'}]} />
							<View style={[ss.cover]} onLayout={this.onWheelLayout} {...wheelPanHandlers} ref={r => { this.wheel = r }}></View>
						</View>
					</View> }
				</View> }
				{ !swatchesOnly && !sliderHidden && (discrete ? <View style={[ss.swatches,swatchStyle]} key={'$2'}>{ this.disc }</View> : <View style={[ss.slider,sliderStyle]} key={'$2'}>
					<View style={[ss.grad]}></View>
					<Animated.View style={[ss.sliderThumb,sliderThumbStyle,Elevations[4],{pointerEvents:'none'}]} />
					<View style={[ss.cover]} onLayout={this.onSliderLayout} {...sliderPanHandlers} ref={r => { this.slider = r }}></View>
				</View>) }
				{ swatches && swatchesLast && <View style={[ss.swatches,swatchStyle]} key={'SW'}>{ this.swatches }</View> }
			</View>
		)
	}
}

const ss = StyleSheet.create({
	root: {
		flex: 1,
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'flex-start',
		overflow: 'visible',
		// aspectRatio: 1,
		// backgroundColor: '#ffcccc',
	},
	wheel: {
		// flex: 1,
		// position: 'relative',
		overflow: 'visible',
		minWidth: '80%',
		// aspectRatio: 1,
		// backgroundColor: '#ffccff',
	},
	wheelWrap: {
		width: '100%',
		height: '100%',
		// backgroundColor: '#ffffcc',
	},
	wheelImg: {
		width: '100%',
		height: '100%',
		// backgroundColor: '#ffffcc',
	},
	wheelThumb: {
		position: 'absolute',
		// backgroundColor: '#EEEEEE',
		borderWidth: 1,
		elevation: 4,
	},
	cover: {
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: '100%',
		// backgroundColor: '#ccccff88',
	},
	slider: {
		// position: 'absolute',
		left: 30,
		paddingHorizontal: 30,
		elevation: 4,
		// backgroundColor: '#ccccff',
	},
	sliderThumb: {
		position: 'absolute',
		top: 0,
		left: 0,
		borderWidth: 1,
		borderColor: '#EEEEEE',
		backgroundColor: '#FFFFFF',
		elevation: 4,
		// backgroundColor: '#f00',
	},
	grad: {
		position: 'absolute',
		top: '50%',
		left: 0,
		width: '100%',
		height: 2,
		backgroundColor: '#838388',
	},
	swatches: {
		width: '100%',
		flexDirection: 'row',
		justifyContent: 'space-between',
		flexWrap: 'wrap',
		marginTop: 16,
		// padding: 16,
		overflow: 'hidden',
	},
	swatchContainer: {
		flexBasis: '20%',
		alignItems: 'center'
	},
	swatch: {
		width: 35,
		height: 35,
		borderRadius: 35,
		marginBottom: 16,
		// borderWidth: 1,
		borderColor: '#8884',
		alignItems: 'center',
		justifyContent: 'center',
		overflow: 'visible'
	},
	swatchTouch: {
		width: 35,
		height: 35,
		borderRadius: 35,
		backgroundColor: '#f004',
		overflow: 'hidden',
	},
})
