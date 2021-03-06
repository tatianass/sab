(function() {
  'use strict';

  angular.module('sabApp')
    .controller('MapaCtrl', MapaCtrl);

  MapaCtrl.$inject = ['$scope', 'Reservatorio', 'RESTAPI','LEGENDCOLORS', 'olData', '$location'];

  /*jshint latedef: nofunc */
  function MapaCtrl($scope, Reservatorio, RESTAPI, LEGENDCOLORS, olData, $location) {
    var vm = this;
    vm.reservatorios = [];
    vm.reservatorioSelecionado = {
      nome: "",
      volumes: []
    };
    vm.selectedTab = 1;
    vm.showInfo = true;
    vm.loadingMap = true;
    vm.loadingInfo = true;
    vm.showSearchbar = false;
    vm.showLegend = false;
    vm.gotError = false;

    var larguraTela = $(window).width();

    if( larguraTela <= 1000 ) {
      vm.zoomInicial = 5;
      vm.latitude = -9.4044477;
      vm.longitude = -40.507917;
    } else {
      vm.zoomInicial = 6;
      vm.latitude = -10.240929;
      vm.longitude = -44.231820;
    }

    vm.map = {
      center: {
        lat: vm.latitude,
        lon: vm.longitude,
        zoom: vm.zoomInicial
      },
      markers: [],
      layers: [
        {
          name: 'TileMap',
          active: true,
          source: {
            type: 'MapBoxStudio',
            mapId: 'citep6zo000242inxhqdd19p2',
            userId: 'jeffersonrpn',
            accessToken: 'pk.eyJ1IjoiamVmZmVyc29ucnBuIiwiYSI6ImNpcnZhc2FoMTBpZGtmYW04M3IyZTZ6NWoifQ.xTtlY-a--vOAS25Op_7uIA'
          }
        },
        {
          name: 'semiarido',
          source: {
            type: 'TopoJSON',
            url: RESTAPI.url+'/estados/sab'
          },
          style: semiaridoStyle()
        }
      ],
      defaults: {
          events: {
              map: ['pointermove', 'mousemove'],
              layers: [ 'mousemove', 'click' ]
          },
          controls: {
              zoom: false,
              rotate: false,
              attribution: false
          },
          interactions: {
              mouseWheelZoom: true
          },
          view: {
              maxZoom: 16,
              minZoom: 4
          }
      }
    };
    vm.reservatoriosGeo = [];

    vm.coresReservatorios = LEGENDCOLORS.reservoirsColors;

    vm.setReservatorio = setReservatorio;
    vm.isSelectedTab = isSelectedTab;
    vm.setSelectedTab = setSelectedTab;
    vm.toggleInfo = toggleInfo;
    vm.hideInfo = hideInfo;
    vm.toggleSearchbar = toggleSearchbar;
    vm.toggleLegend = toggleLegend;


    function init() {
      Reservatorio.info.query(function(data) {
        vm.reservatorios = data;
        if (Number.isInteger(parseInt($location.search().id)) && vm.reservatoriosGeo.length) {
          vm.setReservatorio(parseInt($location.search().id));
        }
      });

      Reservatorio.geolocalizacao.query(function(data) {
        vm.reservatoriosGeo = data.features;
        if (Number.isInteger(parseInt($location.search().id)) && vm.reservatorios.length) {
          vm.setReservatorio(parseInt($location.search().id));
        }
        vm.map.layers.push({
          name: 'reservatorios',
          source: {
            type: 'GeoJSON',
            geojson: {
                projection: "EPSG:4326",
                object: data
            }
          },
          style: reservStyle()
        });
        vm.loadingMap = false;
      }, function(error) {
        vm.loadingMap = false;
        vm.gotError = true;
      });
    }
    init();

    function setReservatorio(id) {
      vm.loadingInfo = true;
      vm.showInfo = true;
      vm.showSearchbar = false;
      vm.showLegend = false;

      for (var i = 0; i < vm.reservatorios.length; i++) {
        if (parseInt(vm.reservatorios[i].id) === id) {
          vm.reservatorioSelecionado = vm.reservatorios[i];
          break;
        }
      }
      if (vm.reservatorioSelecionado.id){
        for (var i = 0; i < vm.reservatoriosGeo.length; i++) {
          if (vm.reservatoriosGeo[i].properties.id === vm.reservatorioSelecionado.id) {
            vm.map.markers = [{
              lat: parseFloat(vm.reservatoriosGeo[i].properties.latitude),
              lon: parseFloat(vm.reservatoriosGeo[i].properties.longitude)
            }];
            break;
          }
        }
        $location.search('id', vm.reservatorioSelecionado.id);
        $location.search('reservatorio', vm.reservatorioSelecionado.nome_sem_acento.replace(/ /g, "_").toLowerCase());

        efeitoZoom(vm.map.markers[0].lat, vm.map.markers[0].lon, 10);
        var data = Reservatorio.monitoramento.query({id: vm.reservatorioSelecionado.id}, function() {
          vm.reservatorioSelecionado.volumes = data.volumes;
          vm.reservatorioSelecionado.volumes_recentes = data.volumes_recentes;
          vm.loadingInfo = false;
        });
      }
    }

    function isSelectedTab(tab) {
      return vm.selectedTab === tab;
    }

    function setSelectedTab(tab) {
      vm.selectedTab = tab;
    }

    function toggleInfo() {
      vm.showInfo = !vm.showInfo;
    }

    function toggleSearchbar() {
      vm.showSearchbar = !vm.showSearchbar;
    }

    function toggleLegend() {
      vm.showLegend = !vm.showLegend;
    }

    function hideInfo() {
      vm.showInfo = false;
    }

    function tamanhoReservatorio(feature, zoom) {
      // Esse 1.8 é para tirar a diferença do zoomInicial com o log(zoom);
      var tamanho = Math.abs(Math.log(feature.get("capacidade")))+(vm.zoomInicial+1.8) - Math.log(zoom);
      if (tamanho < 2){
        tamanho = 2;
      }
      return tamanho;

    }

    function corReservatorio(feature) {
      if(feature.get("volume_percentual") === null) {
        return new ol.style.Fill({ color: vm.coresReservatorios[5].cor});
      } else{
        var volume_percentual = parseFloat(feature.get("volume_percentual"));

        if (volume_percentual  <= 10){
          return new ol.style.Fill({ color: vm.coresReservatorios[0].cor});
        }else if (volume_percentual <= 25){
          return new ol.style.Fill({ color: vm.coresReservatorios[1].cor});
        } else if (volume_percentual <= 50){
          return new ol.style.Fill({ color: vm.coresReservatorios[2].cor});
        } else if (volume_percentual <= 75){
          return new ol.style.Fill({ color: vm.coresReservatorios[3].cor});
        } else{
          return new ol.style.Fill({ color: vm.coresReservatorios[4].cor});
        }
      }

    }

    function reservStyle() {
      return function(feature, zoom) {
        return [new ol.style.Style({
          image: new ol.style.Circle({
            radius:tamanhoReservatorio(feature, zoom),
            fill: corReservatorio(feature)
          })
        })];
      };
    }

    function semiaridoStyle() {
      return new ol.style.Style({
        fill: new ol.style.Fill({color: "rgba(0, 0, 0, 0.1)"})
      });
    }

    $scope.$on('openlayers.layers.reservatorios.click', function(event, feature) {
      $scope.$apply(function() {
          if(feature) {
            vm.setReservatorio(feature.get('id'));
          }
      });
    });

    $scope.$on('openlayers.map.pointermove', function (e, data) {
        $scope.$apply(function () {
            olData.getMap().then(function (map) {
                var pixel = map.getEventPixel(data.event.originalEvent);
                var hit = map.forEachFeatureAtPixel(pixel, function (feature, layer) {
                  if(layer.get('name')==="reservatorios"){
                    map.getTarget().style.cursor = 'pointer';
                    return true;
                  }
                    return false;
                });

                if (typeof hit === 'undefined') {
                    map.getTarget().style.cursor = '';
                    return;
                }
            });
        });
    });

    function efeitoZoom(lat, lon, zoom) {
      larguraTela = $(window).width();
      var latMais = 0;
      var lonMais = 0;

      if(larguraTela < 1600 && larguraTela > 1000){
        lonMais = -0.4;
      } else if( larguraTela <= 1000 ) {
        latMais = -0.2;
      }

      var reservatorio = ol.proj.fromLonLat([lon + lonMais,lat + latMais]);
      olData.getMap().then(function(map) {
        var bounce = ol.animation.bounce({
            resolution: 750,
            duration: 2000
          });
        var pan = ol.animation.pan({
            duration: 2000,
            source: map.getView().getCenter()
          });
        map.beforeRender(pan, bounce);
        map.getView().setCenter(reservatorio);
        map.getView().setZoom(zoom);

      });
    }

  }
})();
