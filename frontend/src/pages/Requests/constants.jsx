import { BankOutlined, LaptopOutlined } from '@ant-design/icons';

export const STATUS = {
  PENDENTE: { label: 'Aguardando aprovação', className: 'status-pendente' },
  APROVADA: { label: 'Aprovada', className: 'status-aprovada' },
  RECUSADA: { label: 'Recusada', className: 'status-recusada' },
};

export const ICONES_TIPO = {
  SALA: <BankOutlined />,
  EQUIPAMENTO: <LaptopOutlined />,
};
