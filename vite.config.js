import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        host: true, // pozwala otworzyć aplikację z innych urządzeń w tej samej sieci (np. tabletu) podczas developmentu
    },
});
