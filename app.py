from flask import Flask, render_template, jsonify, request 
import pandas as pd
import numpy as np
import json
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib
import os

app = Flask(__name__)

# Simulação de dados de energia (em produção real, usar dados reais)
def generate_sample_data():
    regions = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']
    energy_types = ['Hidrelétrica', 'Termelétrica', 'Eólica', 'Solar', 'Nuclear']
    
    data = []
    for region in regions:
        for year in range(2010, 2024):
            total_energy = np.random.uniform(1000, 5000)
            energy_mix = np.random.dirichlet(np.ones(5)) * total_energy
            
            record = {
                'region': region,
                'year': year,
                'total_energy': total_energy,
                'population': np.random.uniform(1000000, 50000000),
                'gdp_growth': np.random.uniform(-2, 8),
                'solar_potential': np.random.uniform(50, 95),
                'wind_potential': np.random.uniform(30, 90),
                'hydro_potential': np.random.uniform(40, 85)
            }
            
            for i, energy_type in enumerate(energy_types):
                record[f'energy_{energy_type.lower()}'] = energy_mix[i]
            
            data.append(record)
    
    return pd.DataFrame(data)

# Inicializar dados e modelos
try:
    df = pd.read_csv('data/energy_data.csv')
except:
    df = generate_sample_data()
    os.makedirs('data', exist_ok=True)
    df.to_csv('data/energy_data.csv', index=False)

# Treinar modelo de ML
def train_models():
    # Modelo para prever potencial solar
    X_solar = df[['year', 'population', 'gdp_growth', 'solar_potential']]
    y_solar = df['energy_solar']
    
    X_train, X_test, y_train, y_test = train_test_split(
        X_solar, y_solar, test_size=0.2, random_state=42
    )
    
    solar_model = RandomForestRegressor(n_estimators=100, random_state=42)
    solar_model.fit(X_train, y_train)
    
    # Modelo para transição energética
    X_transition = df[['year', 'population', 'gdp_growth', 'solar_potential', 'wind_potential', 'hydro_potential']]
    y_transition = df[['energy_solar', 'energy_eólica', 'energy_hidrelétrica']]
    
    transition_model = RandomForestRegressor(n_estimators=100, random_state=42)
    transition_model.fit(X_transition, y_transition)
    
    return solar_model, transition_model

solar_model, transition_model = train_models()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/regions')
def get_regions_data():
    regions_data = {
        'Norte': {
            'center': [-3.4653, -62.2159],
            'states': ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO']
        },
        'Nordeste': {
            'center': [-9.6504, -42.1750],
            'states': ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE']
        },
        'Centro-Oeste': {
            'center': [-15.8267, -47.9218],
            'states': ['DF', 'GO', 'MT', 'MS']
        },
        'Sudeste': {
            'center': [-19.9167, -43.9335],
            'states': ['ES', 'MG', 'RJ', 'SP']
        },
        'Sul': {
            'center': [-27.5954, -48.5480],
            'states': ['PR', 'RS', 'SC']
        }
    }
    return jsonify(regions_data)

@app.route('/api/region/<region_name>')
def get_region_data(region_name):
    region_df = df[df['region'] == region_name]
    
    if region_df.empty:
        return jsonify({'error': 'Região não encontrada'}), 404
    
    # Dados atuais
    current_data = region_df[region_df['year'] == 2023].iloc[0].to_dict()
    
    # Evolução histórica
    historical = region_df.groupby('year').agg({
        'energy_hidrelétrica': 'sum',
        'energy_termelétrica': 'sum',
        'energy_eólica': 'sum',
        'energy_solar': 'sum',
        'energy_nuclear': 'sum',
        'total_energy': 'sum'
    }).reset_index().to_dict('records')
    
    # Previsões para o futuro
    future_years = [2024, 2025, 2026, 2027, 2028]
    predictions = []
    
    for year in future_years:
        prediction_input = [[
            year,
            current_data['population'],
            current_data['gdp_growth'],
            current_data['solar_potential'],
            current_data['wind_potential'],
            current_data['hydro_potential']
        ]]
        
        transition_pred = transition_model.predict(prediction_input)[0]
        
        predictions.append({
            'year': year,
            'solar': max(0, transition_pred[0]),
            'eolica': max(0, transition_pred[1]),
            'hidreletrica': max(0, transition_pred[2]),
            'total_estimated': sum(transition_pred)
        })
    
    # Recomendações baseadas em ML
    recommendations = generate_recommendations(current_data, predictions)
    
    return jsonify({
        'current_data': current_data,
        'historical': historical,
        'predictions': predictions,
        'recommendations': recommendations
    })

def generate_recommendations(current_data, predictions):
    recommendations = []
    
    solar_ratio = current_data['energy_solar'] / current_data['total_energy']
    wind_ratio = current_data['energy_eólica'] / current_data['total_energy']
    
    if solar_ratio < 0.1 and current_data['solar_potential'] > 70:
        recommendations.append({
            'type': 'solar',
            'priority': 'alta',
            'message': f'Alto potencial para energia solar ({current_data["solar_potential"]:.1f}%)',
            'suggestion': 'Investir em parques solares e incentivar microgeração'
        })
    
    if wind_ratio < 0.15:
        recommendations.append({
            'type': 'eolica',
            'priority': 'media',
            'message': f'Potencial eólico moderado ({current_data["wind_potential"]:.1f}%)',
            'suggestion': 'Desenvolver projetos eólicos em áreas costeiras'
        })
    
    if current_data['energy_termelétrica'] / current_data['total_energy'] > 0.3:
        recommendations.append({
            'type': 'transição',
            'priority': 'alta',
            'message': 'Alta dependência de termelétricas',
            'suggestion': 'Substituir gradualmente por fontes renováveis'
        })
    
    return recommendations

@app.route('/api/predict-transition', methods=['POST'])
def predict_transition():
    data = request.json
    region = data['region']
    target_year = data['year']
    
    region_data = df[df['region'] == region].iloc[-1]
    
    prediction_input = [[
        target_year,
        region_data['population'],
        region_data['gdp_growth'],
        region_data['solar_potential'],
        region_data['wind_potential'],
        region_data['hydro_potential']
    ]]
    
    prediction = transition_model.predict(prediction_input)[0]
    
    return jsonify({
        'solar_potential': max(0, prediction[0]),
        'wind_potential': max(0, prediction[1]),
        'hydro_potential': max(0, prediction[2]),
        'total_renewable': sum(prediction)
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
