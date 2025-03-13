import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {MTLLoader} from 'three/addons/loaders/MTLLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

function main() {

	const canvas = document.querySelector( '#c' );
	const renderer = new THREE.WebGLRenderer( { antialias: true, canvas } );

	// camera
	const fov = 45;
	const aspect = 2; // the canvas default
	const near = 0.1;
	const far = 100;
	const camera = new THREE.PerspectiveCamera( fov, aspect, near, far );
	camera.position.set( 10, 10, 15 );

	function updateCamera() {
		camera.updateProjectionMatrix();
	}
	
	const gui = new GUI();
	const cameraFolder = gui.addFolder('Camera');
	cameraFolder .add(camera, 'fov', 1, 180).onChange(updateCamera);
	const minMaxGUIHelper = new MinMaxGUIHelper(camera, 'near', 'far', 0.1);
	cameraFolder.add(minMaxGUIHelper, 'min', 0.1, 50, 0.1).name('near').onChange(updateCamera);
	cameraFolder.add(minMaxGUIHelper, 'max', 0.1, 200, 0.1).name('far').onChange(updateCamera);

	const controls = new OrbitControls( camera, canvas );
	controls.target.set( 0, 2, 0 );
	controls.update();

	// scene settings
	const scene = new THREE.Scene();

	const loadManager = new THREE.LoadingManager();
	const loader = new THREE.TextureLoader(loadManager);

	{ // plane
		const planeSize = 10;

		const texture = loader.load( 'https://threejs.org/manual/examples/resources/images/checker.png' );
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.magFilter = THREE.NearestFilter;
		const repeats = planeSize / 2;
		texture.repeat.set( repeats, repeats );

		const planeGeo = new THREE.PlaneGeometry( planeSize, planeSize );
		const planeMat = new THREE.MeshPhongMaterial( {
			map: texture,
			side: THREE.DoubleSide,
		} );
		const mesh = new THREE.Mesh( planeGeo, planeMat );
		mesh.rotation.x = Math.PI * - .5;
		scene.add( mesh );
	}

	{ // skybox
		const skyTexture = loader.load(
		'./resources/images/industrial_sunset_puresky.jpg',
		() => {
			skyTexture.mapping = THREE.EquirectangularReflectionMapping;
			skyTexture.colorSpace = THREE.SRGBColorSpace;
			scene.background = skyTexture;
		});
	}

	{ // fog
		const fogColor = 0x2e5cb8;  // medium blue
		const fogDensity = 0.03;
		scene.fog = new THREE.FogExp2(fogColor, fogDensity);
	}

	{ // ambient light
		const color = 0xFFFFFF;
		const intensity = 1;
		const light = new THREE.AmbientLight(color, intensity);
		scene.add(light);

		const ambientFolder = gui.addFolder('Ambient Light');
		ambientFolder.addColor(new ColorGUIHelper(light, 'color'), 'value').name('color');
		ambientFolder.add(light, 'intensity', 0, 5, 0.01).name('intensity');
	}

	{ // hemisphere light
		const skyColor = 0xB1E1FF; // light blue
		const groundColor = 0xB97A20; // brownish orange
		const intensity = 2;
		const light = new THREE.HemisphereLight( skyColor, groundColor, intensity );
		scene.add( light );

		const hemisphereFolder = gui.addFolder('Hemisphere Light');
		hemisphereFolder.addColor(new ColorGUIHelper(light, 'color'), 'value').name('skyColor');
		hemisphereFolder.addColor(new ColorGUIHelper(light, 'groundColor'), 'value').name('groundColor');
		hemisphereFolder.add(light, 'intensity', 0, 5, 0.01).name('intensity');
	}

	{ // directional light
		const color = 0xFFFFFF;
		const intensity = 2.5;
		const light = new THREE.DirectionalLight( color, intensity );
		light.position.set( 0, 10, 0 );
		light.target.position.set( - 5, 0, 0 );
		scene.add(light);
		scene.add(light.target);

		const directionalFolder = gui.addFolder('Directional Light');
		directionalFolder.addColor(new ColorGUIHelper(light, 'color'), 'value').name('color');
		directionalFolder.add(light, 'intensity', 0, 5, 0.01);
		directionalFolder.add(light.target.position, 'x', -10, 10);
		directionalFolder.add(light.target.position, 'z', -10, 10);
		directionalFolder.add(light.target.position, 'y', 0, 10);
	}

	{ // imported 3D model (cat)
		const objLoader = new OBJLoader();
		const mtlLoader = new MTLLoader();
		mtlLoader.load('./resources/models/cat/12221_Cat_v1_l3.mtl', (mtl) => {
			mtl.preload();
			objLoader.setMaterials(mtl);
		objLoader.load('./resources/models/cat/12221_Cat_v1_l3.obj', (root) => {
			scene.add(root);
			root.position.z = -1;
			root.rotation.x = Math.PI * - .5;
			root.scale.set(0.1,0.1,0.1);
		});
		});
	}

	{ // billboard
		const spriteTexture = loader.load( './resources/images/cat-emoji.png' );
		const spriteMaterial = new THREE.SpriteMaterial({
			map: spriteTexture,
			transparent: true,
		});
		const root = new THREE.Object3D();
		scene.add(root);
		root.position.x = 0;
		root.position.y = 0;

		const sprite1 = new THREE.Sprite(spriteMaterial);
		root.add(sprite1);
		sprite1.position.x = 2;
		sprite1.position.y = 5;
		const sprite2 = new THREE.Sprite(spriteMaterial);
		root.add(sprite2);
		sprite2.position.x = -3;
		sprite2.position.y = 6;
		sprite2.scale.set(2,2,2);
		const sprite3 = new THREE.Sprite(spriteMaterial);
		root.add(sprite3);
		sprite3.position.x = 1;
		sprite3.position.y = 9;
	}

	// shadows
	const shadowBases = [];

	const shadowTexture = loader.load('./resources/images/roundshadow.png');
	const sphereRadius = 1;
	const planeSize = 1;
	const shadowGeo = new THREE.PlaneGeometry(planeSize, planeSize);

	// ----- ADDING SHAPES ----- //
	const spinnyShapes = [];
	const bouncyShapes = [];

	{ // boxes (cubes and rectangular prisms)
		makeColorBox(1, 1, 1, 0x44aa88, -2, 1, 3, 'spinny');
		makeSingleTexturedBox(1, 1, 1, './resources/images/wall.jpg', 0, 1, 3, 'spinny');

		const multiBox1Materials = [
			new THREE.MeshBasicMaterial({map: loadColorTexture('./resources/images/flower-1.jpg')}),
			new THREE.MeshBasicMaterial({map: loadColorTexture('./resources/images/flower-2.jpg')}),
			new THREE.MeshBasicMaterial({map: loadColorTexture('./resources/images/flower-3.jpg')}),
			new THREE.MeshBasicMaterial({map: loadColorTexture('./resources/images/flower-4.jpg')}),
			new THREE.MeshBasicMaterial({map: loadColorTexture('./resources/images/flower-5.jpg')}),
			new THREE.MeshBasicMaterial({map: loadColorTexture('./resources/images/flower-6.jpg')}),
		];
		makeMultiTexturedBox(1, 1, 1, multiBox1Materials, 2, 1, 3, 'spinny');
		makeColorBox(0.5, 0.5, 0.5, 0x4d79ff, -4, 0, 3, 'all');
		makeColorBox(1, 1, 1, 0xffff99, 0, 0, -2, 'all');

		makeColorBox(8, 1, 1, 0xf2ccff, 0, -0.5, 5.5, 'shadowless');
		makeColorBox(8, 1, 1, 0xf2ccff, 0, -1.5, 6.5, 'shadowless');
		makeColorBox(8, 1, 1, 0xf2ccff, 0, -0.5, -5.5, 'shadowless');
		makeColorBox(8, 1, 1, 0xf2ccff, 0, -1.5, -6.5, 'shadowless');
		makeColorBox(1, 1, 8, 0xf2ccff, 5.5, -0.5, 0, 'shadowless');
		makeColorBox(1, 1, 8, 0xf2ccff, 6.5, -1.5, 0, 'shadowless');
		makeColorBox(1, 1, 8, 0xf2ccff, -5.5, -0.5, 0, 'shadowless');
		makeColorBox(1, 1, 8, 0xf2ccff, -6.5, -1.5, 0, 'shadowless');
	}

	{ // spheres
		makeColorSphere(2, 4, 1, '#CA8', 0, 7, 0, 'spinny');
		makeColorSphere(0.5, 32, 16, 0x13ecec, 2, 0, -4, 'bouncy');
		makeColorSphere(1, 32, 16, 0xb366ff, -5, 9, -5, 'shadowless');
		makeColorSphere(1, 32, 16, 0xb366ff, 5, 9, -5, 'shadowless');
		makeColorSphere(1, 32, 16, 0xb366ff, -5, 9, 5, 'shadowless');
		makeColorSphere(1, 32, 16, 0xb366ff, 5, 9, 5, 'shadowless');
	}

	{ // cylinders
		makeColorCylinder(1, 1, 10, 5, 1, false, 0xffb3ff, -5, 3, -5);
		makeColorCylinder(1, 1, 10, 5, 1, false, 0xffb3ff, 5, 3, -5);
		makeColorCylinder(1, 1, 10, 5, 1, false, 0xffb3ff, 5, 3, 5);
		makeColorCylinder(1, 1, 10, 5, 1, false, 0xffb3ff, -5, 3, 5);
	}


	// -----FUNCTIONS----- // 

	// CUBES
	// color boxes
	function makeColorBox(width, height, depth, color, x, y, z, animated) {
		// shadow base
		const base = new THREE.Object3D();
		scene.add(base);

		const shadowMat = new THREE.MeshBasicMaterial({
			map: shadowTexture,
			transparent: true,    // so we can see the ground
			depthWrite: false,    // so we don't have to sort
		});
		const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
		shadowMesh.position.y = 0.001;  // so we're above the ground slightly
		if (animated == 'bouncy' || animated == "all") {shadowMesh.position.y = -2;}
		shadowMesh.rotation.x = Math.PI * -.5;
		let shadowSize = sphereRadius * 4;
		if (animated == 'shadowless') { shadowSize = 0;}
		shadowMesh.scale.set(shadowSize, shadowSize, shadowSize);
		base.add(shadowMesh);
		
		// box
		const geometry = new THREE.BoxGeometry(width, height, depth);
		const material = new THREE.MeshPhongMaterial({color});
 
		const shapeMesh = new THREE.Mesh(geometry, material);
		base.add(shapeMesh);

		base.position.x = x;
		shapeMesh.position.y = y;
		base.position.z = z;

		if (animated == 'spinny' || animated == "all") { spinnyShapes.push(shapeMesh); }
		if (animated == 'bouncy' || animated == "all") {bouncyShapes.push({base, shapeMesh, shadowMesh, x: base.position.x, y: shapeMesh.position.y, z: base.position.z});}
	}

	// single-texture boxes
	function makeSingleTexturedBox(width, height, depth, textureName, x, y, z, animated) {
		// shadow base
		const base = new THREE.Object3D();
		scene.add(base);

		const shadowMat = new THREE.MeshBasicMaterial({
			map: shadowTexture,
			transparent: true,    // so we can see the ground
			depthWrite: false,    // so we don't have to sort
		});
		const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
		shadowMesh.position.y = 0.001;  // so we're above the ground slightly
		if (animated == 'bouncy' || animated == "all") {shadowMesh.position.y = -2;}
		shadowMesh.rotation.x = Math.PI * -.5;
		let shadowSize = sphereRadius * 4;
		if (animated == 'shadowless') { shadowSize = 0;}
		shadowMesh.scale.set(shadowSize, shadowSize, shadowSize);
		base.add(shadowMesh);

		// box
		const geometry = new THREE.BoxGeometry(width, height, depth);

		const texture = loader.load( textureName )
		texture.colorSpace = THREE.SRGBColorSpace;
		const material = new THREE.MeshBasicMaterial({
			map: texture,
		});

		const shapeMesh = new THREE.Mesh(geometry, material);
		base.add(shapeMesh);

		base.position.x = x;
		shapeMesh.position.y = y;
		base.position.z = z;

		if (animated == 'spinny' || animated == "all") { spinnyShapes.push(shapeMesh); }
		if (animated == 'bouncy' || animated == "all") {bouncyShapes.push({base, shapeMesh, shadowMesh, x: base.position.x, y: shapeMesh.position.y, z: base.position.z});}
	}

	// multi-textured boxes
	function makeMultiTexturedBox(width, height, depth, materialsList, x, y, z, animated) {
		// shadow base
		const base = new THREE.Object3D();
		scene.add(base);

		const shadowMat = new THREE.MeshBasicMaterial({
			map: shadowTexture,
			transparent: true,    // so we can see the ground
			depthWrite: false,    // so we don't have to sort
		});
		const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
		shadowMesh.position.y = 0.001;  // so we're above the ground slightly
		if (animated == 'bouncy' || animated == "all") {shadowMesh.position.y = -2;}
		shadowMesh.rotation.x = Math.PI * -.5;
		let shadowSize = sphereRadius * 4;
		if (animated == 'shadowless') { shadowSize = 0;}
		shadowMesh.scale.set(shadowSize, shadowSize, shadowSize);
		base.add(shadowMesh);

		// box
		const geometry = new THREE.BoxGeometry(width, height, depth);

		const loadingElem = document.querySelector('#loading');
		const progressBarElem = loadingElem.querySelector('.progressbar');

		loadManager.onLoad = () => {
			loadingElem.style.display = 'none';
			const shapeMesh = new THREE.Mesh(geometry, materialsList);
			base.add(shapeMesh);

			base.position.x = x;
			shapeMesh.position.y = y;
			base.position.z = z;

			if (animated == 'spinny' || animated == "all") { spinnyShapes.push(shapeMesh); }
			if (animated == 'bouncy' || animated == "all") {bouncyShapes.push({base, shapeMesh, shadowMesh, x: base.position.x, y: shapeMesh.position.y, z: base.position.z});}
		};
		
		loadManager.onProgress = (urlOfLastItemLoaded, itemsLoaded, itemsTotal) => {
			const progress = itemsLoaded / itemsTotal;
			progressBarElem.style.transform = `scaleX(${progress})`;
		};
	}

	// SPHERES
	// color spheres
	function makeColorSphere(radius, widthDivisions, heightDivisions, color, x, y, z, animated) {
		// shadow base
		const base = new THREE.Object3D();
		scene.add(base);

		const shadowMat = new THREE.MeshBasicMaterial({
			map: shadowTexture,
			transparent: true,    // so we can see the ground
			depthWrite: false,    // so we don't have to sort
		});
		const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
		shadowMesh.position.y = 0.001;  // so we're above the ground slightly
		if (animated == 'bouncy' || animated == "all") {shadowMesh.position.y = -2;}
		shadowMesh.rotation.x = Math.PI * -.5;
		let shadowSize = sphereRadius * 4;
		if (animated == 'shadowless') { shadowSize = 0;}
		shadowMesh.scale.set(shadowSize, shadowSize, shadowSize);
		base.add(shadowMesh);

		// sphere
		const geometry = new THREE.SphereGeometry(radius, widthDivisions, heightDivisions);
		const material = new THREE.MeshPhongMaterial({color});

  		const shapeMesh = new THREE.Mesh(geometry, material);
  		shapeMesh.position.set(0, radius + 2, 0);
  		base.add(shapeMesh);

		base.position.x = x;
		shapeMesh.position.y = y;
		base.position.z = z;

		if (animated == 'spinny' || animated == "all") { spinnyShapes.push(shapeMesh); }
		if (animated == 'bouncy' || animated == "all") {bouncyShapes.push({base, shapeMesh, shadowMesh, x: base.position.x, y: shapeMesh.position.y, z: base.position.z});}
	}

	// CYLINDERS
	// color cylinders
	function makeColorCylinder(radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded, color, x, y, z) {
		const base = new THREE.Object3D();
		scene.add(base);

		const shadowMat = new THREE.MeshBasicMaterial({
			map: shadowTexture,
			transparent: true,    // so we can see the ground
			depthWrite: false,    // so we don't have to sort
		});
		const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
		shadowMesh.position.y = -2;  // so we're above the ground slightly
		shadowMesh.rotation.x = Math.PI * -.5;
		const shadowSize = sphereRadius * 4;
		shadowMesh.scale.set(shadowSize, shadowSize, shadowSize);
		base.add(shadowMesh);
		
		const geometry = new THREE.CylinderGeometry( radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded); 
		const material = new THREE.MeshLambertMaterial( {color} ); 

		const shapeMesh = new THREE.Mesh( geometry, material ); 
		base.add(shapeMesh);

		base.position.x = x;
		shapeMesh.position.y = y;
		base.position.z = z;
	}


	// LOADING AND RENDERING

	function loadColorTexture( path ) {
	  const texture = loader.load( path );
	  texture.colorSpace = THREE.SRGBColorSpace;
	  return texture;
	}

	function resizeRendererToDisplaySize( renderer ) {
		const canvas = renderer.domElement;
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		const needResize = canvas.width !== width || canvas.height !== height;
		if ( needResize ) {

			renderer.setSize( width, height, false );

		}
		return needResize;
	}

	function render( time ) {
		time *= 0.001;

		if ( resizeRendererToDisplaySize( renderer ) ) {
			const canvas = renderer.domElement;
			camera.aspect = canvas.clientWidth / canvas.clientHeight;
			camera.updateProjectionMatrix();

		}

		spinnyShapes.forEach( ( shape, ndx ) => {
			const speed = 1 + ndx * .1;
			const rot = time * speed;
			shape.rotation.x = rot;
			shape.rotation.y = rot;

		} );

		bouncyShapes.forEach((bouncyShape, ndx) => {
			const {base, shapeMesh, shadowMesh, x, y, z} = bouncyShape;
		 
			// u is a value that goes from 0 to 1 as we iterate the spheres
			const u = ndx / bouncyShapes.length;
		 
			// compute a position for the base. This will move
			// both the sphere and its shadow
			const speed = time * .2;
			const angle = speed + u * Math.PI * 2 * (ndx % 1 ? 1 : -1);
			const radius = Math.sin(speed - ndx) * 10;
			base.position.set(Math.cos(angle) * radius + x, 0 + y, Math.sin(angle) * radius + z);
		 
			// yOff is a value that goes from 0 to 1
			const yOff = Math.abs(Math.sin(time * 2 + ndx));
			// move the sphere up and down
			shapeMesh.position.y = y + THREE.MathUtils.lerp(-2, 5, yOff);
			// fade the shadow as the sphere goes up
			shadowMesh.material.opacity = THREE.MathUtils.lerp(1, .25, yOff);
		});

		renderer.render( scene, camera );

		requestAnimationFrame( render );
	}
	requestAnimationFrame( render );
}

main();