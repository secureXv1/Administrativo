import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './assets/main.css'
import "leaflet/dist/leaflet.css";
import 'leaflet.fullscreen/Control.FullScreen.css'
import 'leaflet.fullscreen'

createApp(App).use(createPinia()).use(router).mount('#app')
