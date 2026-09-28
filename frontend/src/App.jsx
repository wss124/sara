import 'antd/dist/reset.css';
import { ConfigProvider } from 'antd';
import AppRoutes from './routes/AppRoutes';

// Paleta institucional: azul-marinho como cor principal dos componentes do Ant Design
const theme = {
  token: {
    colorPrimary: '#13305f',
    colorLink: '#3d2670',
  },
};

function App() {
  return (
    <ConfigProvider theme={theme}>
      <AppRoutes />
    </ConfigProvider>
  );
}

export default App;
