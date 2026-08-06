- name: npm install, build, and test
      run: |
        npm ci
        npm run build --if-present
        npm start & npx wait-on http://localhost:3000
      env:
        CI: true
