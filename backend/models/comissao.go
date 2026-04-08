package models

type ComissaoExtratoItem struct {
	ContratoID            string  `json:"contrato_id"`
	EmpresaNome           string  `json:"empresa_nome"`
	NomeEvento            string  `json:"nome_evento"`
	DataEvento            *string `json:"data_evento"`
	Consultor             string  `json:"consultor"`
	StatusContrato        string  `json:"status_contrato"`
	ValorVenda            float64 `json:"valor_venda"`
	ComissaoPercent       float64 `json:"comissao_percent"`
	ValorComissao         float64 `json:"valor_comissao"`
	ComissaoStatus        string  `json:"comissao_status"`
	ComissaoDataPagamento *string `json:"comissao_data_pagamento"`
	ComissaoPagoPor       *string `json:"comissao_pago_por"`
	ComissaoObservacao    *string `json:"comissao_observacao"`
}

type ComissaoResumo struct {
	TotalRegistros      int     `json:"total_registros"`
	TotalPendente       float64 `json:"total_pendente"`
	TotalPago           float64 `json:"total_pago"`
	TotalMinhaComissao  float64 `json:"total_minha_comissao"`
	QuantidadePendentes int     `json:"quantidade_pendentes"`
	QuantidadePagos     int     `json:"quantidade_pagos"`
}

type ComissaoExtratoResponse struct {
	Itens  []ComissaoExtratoItem `json:"itens"`
	Resumo ComissaoResumo        `json:"resumo"`
}

type ComissaoPagamentoInput struct {
	Observacao string `json:"observacao"`
}
