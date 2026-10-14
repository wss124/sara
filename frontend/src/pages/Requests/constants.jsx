import { BankOutlined, LaptopOutlined } from '@ant-design/icons';

export const STATUS = {
  PENDENTE: { label: 'Aguardando aprovação', className: 'status-pendente' },
  APROVADA: { label: 'Aprovada', className: 'status-aprovada' },
  RECUSADA: { label: 'Recusada', className: 'status-recusada' },
  EM_ANDAMENTO: { label: 'Em uso', className: 'status-andamento' },
  CONCLUIDA: { label: 'Concluída', className: 'status-concluida' },
  CANCELADA: { label: 'Cancelada', className: 'status-cancelada' },
};

export const ICONES_TIPO = {
  SALA: <BankOutlined />,
  EQUIPAMENTO: <LaptopOutlined />,
};
