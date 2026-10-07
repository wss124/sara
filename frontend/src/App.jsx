import 'antd/dist/reset.css';
import { ConfigProvider } from 'antd';
import ptBR from 'antd/locale/pt_BR';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import AppRoutes from './routes/AppRoutes';

dayjs.locale('pt-br');

// Paleta institucional: azul-marinho como cor principal dos componentes do Ant Design
const theme = {
  token: {
    colorPrimary: '#13305f',
    colorLink: '#3d2670',
  },
};

function App() {
  return (
    <ConfigProvider theme={theme} locale={ptBR}>
      <AppRoutes />
    </ConfigProvider>
  );
}

export default App;
